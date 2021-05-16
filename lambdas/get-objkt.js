// https://cryptonomic.github.io/ConseilJS/#/?id=metadata-discovery-functions
// https://github.com/hicetnunc2000/hicetnunc-api/blob/7a87b206d7714cc054fc3497bae68504e5f353d6/lib/conseil.js#L719

const axios = require('axios');
const conseiljs = require('conseiljs');
const {
    ConseilQueryBuilder,
    ConseilOperator,
    ConseilSortDirection,
    TezosConseilClient,
    registerFetch,
    registerLogger,
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

const getIpfsHash = async ipfsHash => (await axios.get(
    'https://cloudflare-ipfs.com/ipfs/' + ipfsHash)).data;

const _block_levels = [
    1365242,
    1372553,
    1375633,
    1377717,
    1379648,
    1382041,
    1384721,
    1388547,
    1390594,
    1393010,
    1394970,
    1396760,
    1398667,
    1400470,
    1401962,
    1403406,
    1404892,
    1406495,
    1407853,
    1409213,
    1410465,
    1411763,
    1413317,
    1414740,
    1416229,
    1417775,
    1419345,
    1420800,
    1422176,
    1423576,
    1424923,
    1426276,
    1427562,
    1428886,
    1430094,
    1431211,
    1432197,
    1433459,
    1434792,
    1436072,
    1437412,
    1438318,
    1439212,
    1440202,
    1440814,
    1441702,
    1442582,
    1443245,
    1444101,
    1444784,
    1445717,
    1446437,
    1447444,
    1448401,
    1449172,
    1450216,
    1451043,
    1451899,
    1453002,
    1453966,
    1454793,
    1455805,
    1456541,
    1457428,
    1458347,
    1458941,
    1459859,
    1460427,
    1461355,
    1462195,
    1463102,
    1464234,
    1465183,
    1466108,
    1467092,
    1467727,
    1468606,
    1469295,
    1470019,
    1470756,
    1471505,
];

const getObjktById = async(id, min_creation_level, max_creation_level) => {
    let objectQuery = ConseilQueryBuilder.blankQuery();
    objectQuery = ConseilQueryBuilder.addFields(
        objectQuery,
        'key',
        'value',
        'block_level');
    objectQuery = ConseilQueryBuilder.addPredicate(
        objectQuery,
        'big_map_id',
        ConseilOperator.EQ,
        [mainnet.nftMetadataMap],
    );
    objectQuery = ConseilQueryBuilder.addPredicate(
        objectQuery,
        'key',
        ConseilOperator.EQ,
        [id],
    );
    if((typeof min_creation_level !== 'undefined') && min_creation_level !== null) {
        if((typeof max_creation_level !== 'undefined') && max_creation_level !== null) {
            objectQuery = ConseilQueryBuilder.addPredicate(
                objectQuery,
                'block_level',
                ConseilOperator.BETWEEN,
                [min_creation_level, max_creation_level],
            );
        } else {
            objectQuery = ConseilQueryBuilder.addPredicate(
                objectQuery,
                'block_level',
                ConseilOperator.GT,
                [min_creation_level],
            );
        }
    }

    objectQuery = ConseilQueryBuilder.addOrdering(
        objectQuery,
        'block_level',
        ConseilSortDirection.DESC,
    );

    objectQuery = ConseilQueryBuilder.setLimit(objectQuery, 1);

    const objectResult = await TezosConseilClient.getTezosEntityData(
        {url: conseilServer, apiKey: conseilApiKey, network: 'mainnet'},
        'mainnet',
        'big_map_contents',
        objectQuery,
    );

    const objectUrl = objectResult[0]['value']
        .toString()
        .replace(/.* 0x([0-9a-z]+) }$/, '$1');
    const ipfsHash = Buffer.from(objectUrl, 'hex').toString().slice(7);

    return {id, ipfsHash};
};

async function getObjkt(id) {
    const id_int = (typeof id == 'string') ? parseInt(id) : id;
    const blockKey = Math.floor(id_int / 1000);
    const block_start = blockKey <= _block_levels.length
        ? _block_levels[blockKey]
        : _block_levels[_block_levels.length - 1];
    const block_end = blockKey + 1 <= _block_levels.length
        ? _block_levels[blockKey + 1]
        : null;
    console.log('block len', _block_levels.length);
    console.log('block_range', blockKey);
    console.log('block_start', block_start);
    console.log('block_end', block_end);
    try {
        const objkt = await getObjktById(id, block_start, block_end);
        const ipfsMetadata = await getIpfsHash(objkt.ipfsHash);
        return {...objkt, ...ipfsMetadata};
    } catch(e) {
        console.log('Error', e);
        return {};
    }
}

exports.handler = async(event) => {
    try {
        const objkt = await getObjkt(event.pathParameters.objktId);
        return {
            statusCode: 200,
            body: JSON.stringify(objkt),
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
