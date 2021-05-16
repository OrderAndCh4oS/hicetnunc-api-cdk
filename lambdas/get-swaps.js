// https://cryptonomic.github.io/ConseilJS/#/?id=metadata-discovery-functions
// https://github.com/hicetnunc2000/hicetnunc-api/blob/7a87b206d7714cc054fc3497bae68504e5f353d6/lib/conseil.js#L719

const conseiljs = require('conseiljs');
const {
    ConseilOperator,
    ConseilQueryBuilder,
    registerFetch,
    registerLogger,
    TezosConseilClient,
    TezosMessageUtils,
} = conseiljs;
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

const getSwapsForAddress = async(address) => {
    let swaps = [];
    let swapsQuery = ConseilQueryBuilder.blankQuery();
    swapsQuery = ConseilQueryBuilder.addFields(
        swapsQuery,
        'key',
        'value',
    );
    swapsQuery = ConseilQueryBuilder.addPredicate(
        swapsQuery,
        'big_map_id',
        ConseilOperator.EQ,
        [mainnet.nftSwapMap],
    );

    let addrHash = `0x${TezosMessageUtils.writeAddress(address)}`;
    swapsQuery = ConseilQueryBuilder.addPredicate(
        swapsQuery,
        'value',
        ConseilOperator.LIKE,
        [`Pair (Pair ${addrHash} `],
    );
    swapsQuery = ConseilQueryBuilder.setLimit(swapsQuery, 1000);

    const swapsResult = await TezosConseilClient.getTezosEntityData(
        {url: conseilServer, apiKey: conseilApiKey, network: 'mainnet'},
        'mainnet',
        'big_map_contents',
        swapsQuery,
    );
    const swapStoragePattern = new RegExp(
        `Pair [(]Pair ${addrHash} ([0-9]+)[)] [(]Pair ([0-9]+) ([0-9]+)[)]`,
    );

    try {
        swapsResult.map((row) => {
            const match = swapStoragePattern.exec(row['value']);

            swaps.push({
                swap_id: row['key'],
                token_id: match[2],
                objkt_amount: match[1],
                xtz_per_objkt: match[3],
            });
        });
    } catch(error) {
        console.log(`failed to process swaps for ${address} with ${error}`);
    }

    return swaps.reduce((obj, swap) => {
            const swapData = {
                objktCount: Number(swap.objkt_amount),
                xtz: swap.xtz_per_objkt,
            };
            if(swap.token_id in obj) {
                const foundPrice = obj[swap.token_id].find(s => s.xtz === swapData.xtz);
                if(foundPrice) {
                    foundPrice.objktCount += swapData.objktCount;
                } else {
                    obj[swap.token_id].push(swapData);
                }
                obj[swap.token_id] = obj[swap.token_id].sort((a, b) => a.xtz - b.xtz);
            } else {
                obj[swap.token_id] = [swapData];
            }
            return obj;
        },
        {});
};

exports.handler = async(event) => {
    try {
        console.log('address', event.pathParameters.address);
        const swaps = await getSwapsForAddress(event.pathParameters.address);
        console.log('swaps', swaps);
        return {
            statusCode: 200,
            body: JSON.stringify(swaps),
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

