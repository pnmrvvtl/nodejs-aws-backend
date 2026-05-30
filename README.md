# Product Service

Task 4 - AWS Lambda-based Product Service built with AWS CDK, API Gateway, DynamoDB and Node.js.

## Deployed API

Base URL: `https://r9rcu7ik4b.execute-api.eu-central-1.amazonaws.com/prod`

Products: `https://r9rcu7ik4b.execute-api.eu-central-1.amazonaws.com/prod/products`

Product by id: `https://r9rcu7ik4b.execute-api.eu-central-1.amazonaws.com/prod/products/1`

Create product: `POST https://r9rcu7ik4b.execute-api.eu-central-1.amazonaws.com/prod/products`

Example create product body:

```json
{
  "title": "Monitor Stand",
  "description": "Aluminum desk stand",
  "price": 80,
  "count": 10
}
```

`price` and `count` must be numbers. Numeric strings such as `"80"` are rejected with status `400`.

## Product Schema

```typescript
type Product = {
  id: string;          // Unique identifier
  title: string;       // Product name
  description: string; // Product description
  price: number;       // Price in USD
  count: number;       // Available stock
}
```

## Deployment

- **CloudFront URL:** d2mj199qwf9cum.cloudfront.net 
- **S3 Bucket:** infrastack-spabucket48e1059f-oi7f5twqkpu2.s3.eu-central-1.amazonaws.com

## Import Service

Task 5 - Integration with S3.

Base URL: `https://023c4fjkl3.execute-api.eu-central-1.amazonaws.com/prod/`

Import products file: `GET https://023c4fjkl3.execute-api.eu-central-1.amazonaws.com/prod/import?name=products.csv`

S3 Import Bucket: `rs-back-import`

Uploaded files prefix: `uploaded/`

Parsed files prefix: `parsed/`

After a CSV file is uploaded to `uploaded/`, the `importFileParser` Lambda is triggered by an S3 `ObjectCreated` event. It reads the CSV file as a stream, sends each parsed row to SQS, copies the processed file to `parsed/`, and removes the original file from `uploaded/`.

Task 5 was verified with `products-test.csv`:

- File uploaded through the frontend import flow.
- CSV rows were parsed by `/aws/lambda/ImportServiceStack-importFileParser85B01032-nxs6mLZMvVIV`.
- File was moved from `uploaded/products-test.csv` to `parsed/products-test.csv`.

## Async Microservices Communication

Task 6 - Async communication with SQS and SNS.

Flow:

```text
CSV file -> S3 uploaded/ -> importFileParser -> catalogItemsQueue -> catalogBatchProcess -> DynamoDB products/stocks -> createProductTopic
```

SQS Queue: `catalogItemsQueue`

SQS Queue URL: `https://sqs.eu-central-1.amazonaws.com/708935702800/catalogItemsQueue`

SNS Topic: `createProductTopic`

SNS Topic ARN: `arn:aws:sns:eu-central-1:708935702800:createProductTopic`

`catalogBatchProcess` is triggered from `catalogItemsQueue` with `batchSize: 5`.

SNS subscriptions:

- `pnmrv.vtl@gmail.com` receives products with `priceCategory = regular`.
- `pnmrv.vtl+expensive@gmail.com` receives products with `priceCategory = expensive`.

The `priceCategory` message attribute is published by `catalogBatchProcess`: products with `price >= 100` are `expensive`, all others are `regular`.

Task 6 verification:

- Uploaded `task6-products-20260523222106.csv` through the Import Service signed URL.
- File moved to `s3://rs-back-import/parsed/task6-products-20260523222106.csv`.
- `catalogItemsQueue` processed messages and returned to `ApproximateNumberOfMessages = 0`.
- Products appeared in `GET /products`:
  - `Task6 Regular 20260523222106`
  - `Task6 Expensive 20260523222106`

CDK outputs:

- **ApiUrl:** https://023c4fjkl3.execute-api.eu-central-1.amazonaws.com/prod/
- **ImportBucketName:** rs-back-import
- **CatalogItemsQueueUrl:** https://sqs.eu-central-1.amazonaws.com/708935702800/catalogItemsQueue
- **ImportServiceApiEndpoint08D58EAA:** https://023c4fjkl3.execute-api.eu-central-1.amazonaws.com/prod/

## Authorization Service

Task 7 - Authorization.

Authorization Service contains `basicAuthorizer` Lambda. It checks Basic Authorization credentials against Lambda environment variables loaded from `authorization-service/.env`.

Test user:

```text
pnmrvvtl=TEST_PASSWORD
```

Authorization token value for localStorage:

```text
cG5tcnZ2dGw6VEVTVF9QQVNTV09SRA==
```

Use it in browser console:

```javascript
localStorage.setItem("authorization_token", "cG5tcnZ2dGw6VEVTVF9QQVNTV09SRA==");
```

Authorized request:

```bash
curl -H "Authorization: Basic cG5tcnZ2dGw6VEVTVF9QQVNTV09SRA==" "https://023c4fjkl3.execute-api.eu-central-1.amazonaws.com/prod/import?name=products.csv"
```

Expected authorization behavior:

- Missing `Authorization` header returns `401`.
- Invalid Basic token returns `403`.
- Valid Basic token returns signed S3 upload URL.

## Deploy

```bash
npm install
cdk deploy --profile cdk-deploy
```
