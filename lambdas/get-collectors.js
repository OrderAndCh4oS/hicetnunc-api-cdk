const axios = require('axios');

async function getCollectors(objktId) {
    const response = await axios.get(
        'https://api.better-call.dev/v1/contract/mainnet/KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton/tokens/holders?token_id=' +
        objktId,
    );

    const collectors = response.data;

    if('tz1burnburnburnburnburnburnburjAYjjX' in collectors)
        delete collectors.tz1burnburnburnburnburnburnburjAYjjX;

    const total = Object.values(collectors).reduce((acc, i) => acc + ~~Number(i), 0);
    const available = collectors?.KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9 || 0;

    return {total, collectors, available};
}

exports.handler = async(event) => {
    try {
        const collectors = await getCollectors(event.pathParameters.objktId);
        return {
            statusCode: 200,
            body: JSON.stringify(collectors),
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
