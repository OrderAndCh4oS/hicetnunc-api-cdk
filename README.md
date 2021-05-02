# Hic et Nunc API CDK 

This is a trimmed down API with some useful endpoints for grabbing data about any wallet or objkt. 

## Getting Started

Run `npm install` in the root and the lambdas directory. 

Get an api key from https://nautilus.cloud/ and add it to the .env (copy the .env.example to .env).

Run `cdk deploy` (Requires AWS Account is set up and cdk is configured. See: https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html and https://cdkworkshop.com/)

## API Endpoints 

After deploying the CDK the following endpoints will be available. The url is the provided after a successful deploy

```http request
GET {{url}}/creations/{{walletId}}
Accept: application/json

###

GET {{url}}/collections/{{walletId}}
Accept: application/json

###

GET {{url}}/swaps/{{walletId}}
Accept: application/json

###

GET {{url}}/objkts/{{objktId}}
Accept: application/json

###
```

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
