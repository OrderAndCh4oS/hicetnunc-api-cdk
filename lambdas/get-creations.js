// https://cryptonomic.github.io/ConseilJS/#/?id=metadata-discovery-functions
// https://github.com/hicetnunc2000/hicetnunc-api/blob/7a87b206d7714cc054fc3497bae68504e5f353d6/lib/conseil.js#L719

const conseiljs = require('conseiljs');
const {
    ConseilOperator,
    ConseilQueryBuilder,
    ConseilSortDirection,
    registerFetch,
    registerLogger,
    TezosConseilClient,
} = conseiljs;
const log = require('loglevel');
const fetch = require('node-fetch');
const axios = require('axios');

const nautilusApiKey = process.env.NAUTILUS_API_KEY;
if(!nautilusApiKey) throw new Error('Missing NAUTILUS_API_KEY environment variable');

const burnAddress = 'tz1burnburnburnburnburnburnburjAYjjX'

const logger = log.getLogger('conseiljs');
logger.setLevel('error', false);
registerLogger(logger);
registerFetch(fetch);
const conseilServer = 'https://conseil-prod.cryptonomic-infra.tech';
const conseilApiKey = nautilusApiKey;
const mainnet = {
    network: 'mainnet',
    nftContract: 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton',
    hDAOToken: 'KT1AFA2mwNUMNd4SsujE1YYp29vd8BZejyKW',
    curations: 'KT1TybhR7XraG75JFYKSrh7KnxukMBT5dor6',
    protocol: 'KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9',
    nftLedger: 511,
    nftMetadataMap: 514,
    nftSwapMap: 523,
    curationsPtr: 519,
    nftRoyaltiesMap: 522,
    daoLedger: 515,
    kolibriLedger: 380,
    hDaoSwap: 'KT1Qm3urGqkRsWsovGzNb2R81c3dSfxpteHG',
    kolibriSwap: 'KT1K4EwTpbvYN9agJdjpyJm4ZZdhpUNKB3F6',
};

const LATEST_EPOCH = 1424923;
const MILLISECOND_MODIFIER = 1000;
const ONE_MINUTE_MILLIS = 60 * MILLISECOND_MODIFIER;
const ONE_HOUR_MILLIS = 60 * ONE_MINUTE_MILLIS;
const ONE_DAY_MILLIS = 24 * ONE_HOUR_MILLIS;
const ONE_WEEK_MILLIS = 7 * ONE_DAY_MILLIS;

const chunkArray = (arr, len) => {
    let chunks = [],
        i = 0,
        n = arr.length;

    while(i < n) {
        chunks.push(arr.slice(i, (i += len)));
    }

    return chunks;
};

const getCreationsForAddress = async(address) => {
    let mintOperationQuery = ConseilQueryBuilder.blankQuery();
    mintOperationQuery = ConseilQueryBuilder.addFields(
        mintOperationQuery,
        'operation_group_hash',
    );
    mintOperationQuery = ConseilQueryBuilder.addPredicate(
        mintOperationQuery,
        'kind',
        ConseilOperator.EQ,
        ['transaction'],
    );
    mintOperationQuery = ConseilQueryBuilder.addPredicate(
        mintOperationQuery,
        'timestamp',
        ConseilOperator.AFTER,
        [1612240919000],
    ); // 2021 Feb 1
    mintOperationQuery = ConseilQueryBuilder.addPredicate(
        mintOperationQuery,
        'status',
        ConseilOperator.EQ,
        ['applied'],
    );
    mintOperationQuery = ConseilQueryBuilder.addPredicate(
        mintOperationQuery,
        'destination',
        ConseilOperator.EQ,
        [mainnet.protocol],
    );
    mintOperationQuery = ConseilQueryBuilder.addPredicate(
        mintOperationQuery,
        'parameters_entrypoints',
        ConseilOperator.EQ,
        ['mint_OBJKT'],
    );
    mintOperationQuery = ConseilQueryBuilder.addPredicate(
        mintOperationQuery,
        'source',
        ConseilOperator.EQ,
        [address],
    );
    mintOperationQuery = ConseilQueryBuilder.addOrdering(
        mintOperationQuery,
        'block_level',
        ConseilSortDirection.DESC,
    );
    mintOperationQuery = ConseilQueryBuilder.setLimit(
        mintOperationQuery,
        256,
    ); // TODO: this is hardwired and will not work for highly productive artists

    const mintOperationResult = await TezosConseilClient.getTezosEntityData(
        {url: conseilServer, apiKey: conseilApiKey, network: 'mainnet'},
        'mainnet',
        'operations',
        mintOperationQuery,
    );

    const operationGroupIds = mintOperationResult.map(
        (r) => r['operation_group_hash'],
    );
    const queryChunks = chunkArray(operationGroupIds, 30);

    const makeObjectQuery = (opIds) => {
        let mintedObjectsQuery = ConseilQueryBuilder.blankQuery();
        mintedObjectsQuery = ConseilQueryBuilder.addFields(
            mintedObjectsQuery,
            'key_hash',
            'value',
        );
        mintedObjectsQuery = ConseilQueryBuilder.addPredicate(
            mintedObjectsQuery,
            'big_map_id',
            ConseilOperator.EQ,
            [mainnet.nftMetadataMap],
        );
        mintedObjectsQuery = ConseilQueryBuilder.addPredicate(
            mintedObjectsQuery,
            'operation_group_id',
            opIds.length > 1
                ? ConseilOperator.IN
                : ConseilOperator.EQ,
            opIds,
        );
        mintedObjectsQuery = ConseilQueryBuilder.setLimit(
            mintedObjectsQuery,
            opIds.length,
        );

        return mintedObjectsQuery;
    };

    const objectQueries = queryChunks.map((c) => makeObjectQuery(c));

    const objectInfo = await Promise.all(
        objectQueries.map(
            async(q) =>
                await TezosConseilClient.getTezosEntityData(
                    {url: conseilServer, apiKey: conseilApiKey, network: 'mainnet'},
                    'mainnet',
                    'big_map_contents',
                    q,
                ).then((result) =>
                    result.map((row) => {
                        const objectId = row['value']
                            .toString()
                            .replace(/^Pair ([0-9]{1,}) .*/, '$1');
                        const objectUrl = row['value']
                            .toString()
                            .replace(/.* 0x([0-9a-z]{1,}) \}$/, '$1');
                        const ipfsHash = Buffer.from(objectUrl, 'hex').toString().slice(7);

                        return {key: row['key_hash'], objectId, ipfsHash};
                    }),
                ),
        ),
    );

    return objectInfo
        .flat(1)
        .sort((a, b) => parseInt(b.objectId) - parseInt(a.objectId));
};

const filteredBurnedCreations = async creations => {
    const validCreations = []

    await Promise.all(
        creations.map(async (c) => {
            const ownerData = await getObjktOwners(c)

            Object.assign(c, ownerData)

            const burnAddrCount = c.owners[burnAddress] && parseInt(c.owners[burnAddress])
            const allIssuesBurned = burnAddrCount && burnAddrCount === c.total

            if (!allIssuesBurned) {
                delete c.owners
                validCreations.push(c);
            }
        })
    )

    return validCreations
};

async function getObjktOwners(objkt) {
    const owners = (
        await axios.get(
            'https://api.better-call.dev/v1/contract/mainnet/KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton/tokens/holders?token_id=' +
            objkt.objectId
        )
    ).data

    const ownerCountList = Object.values(owners)

    let total = 0

    if (ownerCountList.length) {
        total = ownerCountList.reduce((acc, i) => {
            const owned = parseInt(i)

            return owned > 0 ? acc + owned : acc
        }, 0)
    }

    return {
        total,
        owners,
    }
}

exports.handler = async(event) => {
    try {
        console.log('address', event.pathParameters.address);
        const creations = await getCreationsForAddress(event.pathParameters.address);
        // const filteredCreations = await filteredBurnedCreations(creations);
        return {
            statusCode: 200,
            body: JSON.stringify(creations),
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
        };
    } catch(e) {
        console.log('Error', e);
        return {
            statusCode: 500,
            body: JSON.stringify({error: 'Unhandled error'}),
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
        };
    }
};
