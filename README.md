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

After a CSV file is uploaded to `uploaded/`, the `importFileParser` Lambda is triggered by an S3 `ObjectCreated` event. It reads the CSV file as a stream, logs each parsed row to CloudWatch, copies the processed file to `parsed/`, and removes the original file from `uploaded/`.

Verified with `products-test.csv`:

- File uploaded through the frontend import flow.
- CSV rows appeared in `/aws/lambda/ImportServiceStack-importFileParser85B01032-nxs6mLZMvVIV` CloudWatch logs.
- File was moved from `uploaded/products-test.csv` to `parsed/products-test.csv`.

CDK outputs:

- **ApiUrl:** https://023c4fjkl3.execute-api.eu-central-1.amazonaws.com/prod/
- **ImportBucketName:** rs-back-import
- **ImportServiceApiEndpoint08D58EAA:** https://023c4fjkl3.execute-api.eu-central-1.amazonaws.com/prod/

## Deploy

```bash
npm install
cdk deploy --profile cdk-deploy
```
