import {Construct, Duration, Stack, StackProps} from "@aws-cdk/core";
import {Code, Function, Runtime} from "@aws-cdk/aws-lambda";
import {Cors, EndpointType, LambdaIntegration, RestApi} from "@aws-cdk/aws-apigateway";

export class HicEtNuncApiStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps & { nautilusApiKey: string }) {
        super(scope, id, props);

        const api = new RestApi(this, `HicEtNuncGalleryApi`, {
            restApiName: 'HicEtNuncGalleryApi',
            defaultCorsPreflightOptions: {
                allowOrigins: Cors.ALL_ORIGINS,
                allowMethods: Cors.ALL_METHODS,
                allowHeaders: Cors.DEFAULT_HEADERS,
            },
            deploy: true,
            deployOptions: {
                stageName: 'prod',
                cachingEnabled: true,
                cacheTtl: Duration.minutes(60),
                cacheClusterEnabled: true
            },
            endpointConfiguration: {
                types: [EndpointType.EDGE]
            },
        });

        const creations = new Function(this, 'Creations', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-creations.handler',
            timeout: Duration.seconds(15),
            code: Code.fromAsset('./lambdas'),
            environment: {
                NAUTILUS_API_KEY: props.nautilusApiKey
            }
        });
        const collections = new Function(this, 'Collections', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-collection.handler',
            timeout: Duration.seconds(15),
            code: Code.fromAsset('./lambdas'),
            environment: {
                NAUTILUS_API_KEY: props.nautilusApiKey
            }
        });
        const objkts = new Function(this, 'Objkts', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-objkt.handler',
            timeout: Duration.seconds(8),
            code: Code.fromAsset('./lambdas'),
            environment: {
                NAUTILUS_API_KEY: props.nautilusApiKey
            },
        });
        const swaps = new Function(this, 'Swaps', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-swaps.handler',
            timeout: Duration.seconds(15),
            code: Code.fromAsset('./lambdas'),
            environment: {
                NAUTILUS_API_KEY: props.nautilusApiKey
            }
        });

        const creationsIntegration = new LambdaIntegration(creations, {
            requestParameters: {
                'integration.request.path.address': 'method.request.path.address'
            },
            cacheKeyParameters: ['method.request.path.address']
        })

        const collectionsIntegration = new LambdaIntegration(collections, {
            requestParameters: {
                'integration.request.path.address': 'method.request.path.address'
            },
            cacheKeyParameters: ['method.request.path.address']
        })

        const swapsIntegration = new LambdaIntegration(swaps, {
            requestParameters: {
                'integration.request.path.address': 'method.request.path.address'
            },
            cacheKeyParameters: ['method.request.path.address']
        })

        const objktIntegration = new LambdaIntegration(objkts, {
            requestParameters: {
                'integration.request.path.objktId': 'method.request.path.objktId'
            },
            cacheKeyParameters: ['method.request.path.objktId']
        })

        api.root
            .addResource('creations')
            .addResource('{address}')
            .addMethod('GET', creationsIntegration, {requestParameters: { 'method.request.path.address': true }})
        api.root
            .addResource('collections')
            .addResource('{address}')
            .addMethod('GET', collectionsIntegration, {requestParameters: { 'method.request.path.address': true }})
        api.root
            .addResource('swaps')
            .addResource('{address}')
            .addMethod('GET', swapsIntegration, {requestParameters: { 'method.request.path.address': true }})
        api.root
            .addResource('objkts')
            .addResource('{objktId}')
            .addMethod('GET', objktIntegration, {requestParameters: { 'method.request.path.objktId': true }})
    }
}
