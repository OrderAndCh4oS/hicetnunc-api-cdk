import {Construct, Duration, Stack, StackProps} from "@aws-cdk/core";
import {Code, Function, Runtime} from "@aws-cdk/aws-lambda";
import {Cors, LambdaIntegration, RestApi} from "@aws-cdk/aws-apigateway";

export class HicEtNuncApiStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps & {nautilusApiKey: string}) {
        super(scope, id, props);

        const api = new RestApi(this, `HicEtNuncGalleryApi`, {
            restApiName: 'HicEtNuncGalleryApi',
            defaultCorsPreflightOptions: {
                allowOrigins: Cors.ALL_ORIGINS,
                allowMethods: Cors.ALL_METHODS,
                allowHeaders: Cors.DEFAULT_HEADERS,
            },
        });

        const creations = new Function(this, 'Creations', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-creations.handler',
            timeout: Duration.seconds(10),
            code: Code.fromAsset('./lambdas'),
            environment: {
                NAUTILUS_API_KEY: props.nautilusApiKey
            }
        });
        const collections = new Function(this, 'Collections', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-collection.handler',
            timeout: Duration.seconds(5),
            code: Code.fromAsset('./lambdas'),
            environment: {
                NAUTILUS_API_KEY: props.nautilusApiKey
            }
        });
        const objkts = new Function(this, 'Objkts', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-objkt.handler',
            timeout: Duration.seconds(5),
            code: Code.fromAsset('./lambdas'),
            environment: {
                NAUTILUS_API_KEY: props.nautilusApiKey
            },
        });
        const swaps = new Function(this, 'Swaps', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'get-swaps.handler',
            timeout: Duration.seconds(5),
            code: Code.fromAsset('./lambdas'),
            environment: {
                NAUTILUS_API_KEY: props.nautilusApiKey
            }
        });

        api.root
            .addResource('creations')
            .addResource('{address}')
            .addMethod('GET', new LambdaIntegration(creations))
        api.root
            .addResource('collections')
            .addResource('{address}')
            .addMethod('GET', new LambdaIntegration(collections))
        api.root
            .addResource('swaps')
            .addResource('{address}')
            .addMethod('GET', new LambdaIntegration(swaps))
        api.root
            .addResource('objkts')
            .addResource('{objktId}')
            .addMethod('GET', new LambdaIntegration(objkts))
    }
}
