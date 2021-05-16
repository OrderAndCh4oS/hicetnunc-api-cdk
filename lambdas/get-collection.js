// https://cryptonomic.github.io/ConseilJS/#/?id=metadata-discovery-functions
// https://github.com/hicetnunc2000/hicetnunc-api/blob/7a87b206d7714cc054fc3497bae68504e5f353d6/lib/conseil.js#L719

const conseiljs = require('conseiljs');
const {
    ConseilOperator,
    ConseilQueryBuilder,
    registerFetch,
    registerLogger, TezosConseilClient,
    TezosMessageUtils,
} = conseiljs;
const BigNumber = require('bignumber.js');
const log = require('loglevel');
const fetch = require('node-fetch');

const nautilusApiKey = process.env.NAUTILUS_API_KEY;
if(!nautilusApiKey) throw new Error('Missing NAUTILUS_API_KEY environment variable');

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

const getCollectionForAddress = async(address) => {
    let collectionQuery = ConseilQueryBuilder.blankQuery();
    collectionQuery = ConseilQueryBuilder.addFields(
        collectionQuery,
        'key',
        'value',
        'operation_group_id',
    );
    collectionQuery = ConseilQueryBuilder.addPredicate(
        collectionQuery,
        'big_map_id',
        ConseilOperator.EQ,
        [mainnet.nftLedger],
    );
    collectionQuery = ConseilQueryBuilder.addPredicate(
        collectionQuery,
        'key',
        ConseilOperator.STARTSWITH,
        [`Pair 0x${TezosMessageUtils.writeAddress(address)}`],
    );
    collectionQuery = ConseilQueryBuilder.addPredicate(
        collectionQuery,
        'value',
        ConseilOperator.EQ,
        [0],
        true,
    );
    collectionQuery = ConseilQueryBuilder.setLimit(
        collectionQuery,
        300_000,
    );

    const collectionResult = await TezosConseilClient.getTezosEntityData(
        {url: conseilServer, apiKey: conseilApiKey, network: 'mainnet'},
        'mainnet',
        'big_map_contents',
        collectionQuery,
    );
    let collection = collectionResult.map((i) => {
        return {
            piece: i['key'].toString().replace(/.* ([0-9]+$)/, '$1'),
            amount: Number(i['value']),
            opId: i['operation_group_id'],
        };
    });

    const queryChunks = chunkArray(
        collection.map((i) => i.piece),
        50,
    ); // NOTE: consider increasing this number somewhat
    const makeObjectQuery = (keys) => {
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
            'key',
            keys.length > 1
                ? ConseilOperator.IN
                : ConseilOperator.EQ,
            keys,
        );
        mintedObjectsQuery = ConseilQueryBuilder.setLimit(
            mintedObjectsQuery,
            keys.length,
        );

        return mintedObjectsQuery;
    };

    const objectQueries = queryChunks.map((c) => makeObjectQuery(c));
    const objectIpfsMap = {};
    await Promise.all(
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
                            .replace(/^Pair ([0-9]+) .*/, '$1');
                        const objectUrl = row['value']
                            .toString()
                            .replace(/.* 0x([0-9a-z]+) }$/, '$1');
                        objectIpfsMap[objectId] = Buffer.from(objectUrl, 'hex').toString().slice(7);
                    }),
                ),
        ),
    );

    const operationGroupIds = collectionResult.map((r) => r.operation_group_id);
    const priceQueryChunks = chunkArray(operationGroupIds, 30);
    const makeLastPriceQuery = (opIds) => {
        let lastPriceQuery = ConseilQueryBuilder.blankQuery();
        lastPriceQuery = ConseilQueryBuilder.addFields(
            lastPriceQuery,
            'timestamp',
            'amount',
            'operation_group_hash',
            'parameters_entrypoints',
            'parameters',
        );
        lastPriceQuery = ConseilQueryBuilder.addPredicate(
            lastPriceQuery,
            'kind',
            ConseilOperator.EQ,
            ['transaction'],
        );
        lastPriceQuery = ConseilQueryBuilder.addPredicate(
            lastPriceQuery,
            'status',
            ConseilOperator.EQ,
            ['applied'],
        );
        lastPriceQuery = ConseilQueryBuilder.addPredicate(
            lastPriceQuery,
            'internal',
            ConseilOperator.EQ,
            ['false'],
        );
        lastPriceQuery = ConseilQueryBuilder.addPredicate(
            lastPriceQuery,
            'operation_group_hash',
            opIds.length > 1
                ? ConseilOperator.IN
                : ConseilOperator.EQ,
            opIds,
        );
        lastPriceQuery = ConseilQueryBuilder.setLimit(
            lastPriceQuery,
            opIds.length,
        );

        return lastPriceQuery;
    };

    const priceQueries = priceQueryChunks.map((c) => makeLastPriceQuery(c));
    const priceMap = {};
    await Promise.all(
        priceQueries.map(
            async(q) =>
                await TezosConseilClient.getTezosEntityData(
                    {url: conseilServer, apiKey: conseilApiKey, network: 'mainnet'},
                    'mainnet',
                    'operations',
                    q,
                ).then((result) =>
                    result.map((row) => {
                        let amount = 0;
                        const action = row.parameters_entrypoints;

                        if(action === 'collect') {
                            amount = Number(
                                row.parameters.toString().replace(/^Pair ([0-9]+) [0-9]+/, '$1'),
                            );
                        } else if(action === 'transfer') {
                            amount = Number(
                                row.parameters
                                    .toString()
                                    .replace(
                                        /[{] Pair "[1-9A-HJ-NP-Za-km-z]{36}" [{] Pair "[1-9A-HJ-NP-Za-km-z]{36}" [(]Pair [0-9]+ [0-9]+[)] [}] [}]/,
                                        '$1',
                                    ),
                            );
                        }

                        priceMap[row.operation_group_hash] = {
                            price: new BigNumber(row.amount),
                            amount,
                            timestamp: row.timestamp,
                            action,
                        };
                    }),
                ),
        ),
    );

    collection = collection.map((i) => {
        let price = 0;
        let receivedOn = new Date();
        let action = '';

        try {
            const priceRecord = priceMap[i.opId];
            price = priceRecord.price
                .dividedToIntegerBy(priceRecord.amount)
                .toNumber();
            receivedOn = new Date(priceRecord.timestamp);
            action = priceRecord.action === 'collect' ? 'Purchased' : 'Received';
        } catch {
            //
        }

        delete i.opId;

        return {
            price: isNaN(price) ? 0 : price,
            receivedOn,
            action,
            ipfsHash: objectIpfsMap[i.piece.toString()],
            ...i,
        };
    });

    return collection.sort(
        (a, b) => b.receivedOn.getTime() - a.receivedOn.getTime(),
    );
};

exports.handler = async(event) => {
    try {
        console.log('address', event.pathParameters.address);
        const creations = await getCollectionForAddress(event.pathParameters.address);
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
