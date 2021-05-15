import {Construct, Duration, Stack, StackProps} from "@aws-cdk/core";
import {Code, Function, Runtime} from "@aws-cdk/aws-lambda";
import {Cors, EndpointType, LambdaIntegration, Period, RestApi} from "@aws-cdk/aws-apigateway";

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
                cacheTtl: Duration.minutes(30),
                cacheClusterEnabled: true,
            },
            endpointConfiguration: {
                types: [EndpointType.EDGE]
            },
        });

        const apiUsagePlans = [
            {
                name: "orderandchaos",
                usagePlan: {
                    name: "orderandchaos-usage-plan",
                    throttleRateLimit: 200,
                    throttleBurstLimit: 500,
                    quotaLimit: 100000,
                    period: Period.DAY
                },
                enabled: true
            },
            {
                name: "flygohr",
                usagePlan: {
                    name: "flygohr-usage-plan",
                    throttleRateLimit: 200,
                    throttleBurstLimit: 500,
                    quotaLimit: 100000,
                    period: Period.DAY
                },
                enabled: true
            }
        ];

        for (const user of apiUsagePlans) {
            const key = api.addApiKey(`${user.name}-api-key`, {
                defaultCorsPreflightOptions: {
                    allowOrigins: Cors.ALL_ORIGINS,
                    allowMethods: Cors.ALL_METHODS
                }
            });

            api.addUsagePlan(`${user.name}-usage-plan`, {
                name: `${user.usagePlan.name}-usage-plan`,
                description: `${user.name}'s API usage plan`,
                apiKey: key,
                throttle: {
                    rateLimit: user.usagePlan.throttleRateLimit,
                    burstLimit: user.usagePlan.throttleBurstLimit
                },
                quota: {
                    limit: user.usagePlan.quotaLimit,
                    period: user.usagePlan.period
                }
            })
                .addApiStage({
                    stage: api.deploymentStage
                });
        }

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
        const collectors = new Function(this, 'Collectors', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-collectors.handler',
            timeout: Duration.seconds(8),
            code: Code.fromAsset('./lambdas')
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

        const collectorsIntegration = new LambdaIntegration(collectors, {
            requestParameters: {
                'integration.request.path.objktId': 'method.request.path.objktId'
            },
            cacheKeyParameters: ['method.request.path.objktId']
        })

        api.root
            .addResource('creations')
            .addResource('{address}')
            .addMethod('GET', creationsIntegration, {
                requestParameters: {'method.request.path.address': true},
                apiKeyRequired: true
            })
        api.root
            .addResource('collections')
            .addResource('{address}')
            .addMethod('GET', collectionsIntegration, {
                requestParameters: {'method.request.path.address': true},
                apiKeyRequired: true
            })
        api.root
            .addResource('swaps')
            .addResource('{address}')
            .addMethod('GET', swapsIntegration, {
                requestParameters: {'method.request.path.address': true},
                apiKeyRequired: true
            })
        api.root
            .addResource('objkts')
            .addResource('{objktId}')
            .addMethod('GET', objktIntegration, {
                requestParameters: {'method.request.path.objktId': true},
                apiKeyRequired: true
            })
        api.root
            .addResource('collectors')
            .addResource('{objktId}')
            .addMethod('GET', collectorsIntegration, {
                requestParameters: {'method.request.path.objktId': true},
                apiKeyRequired: true
            })
    }
}
