# Product Service

Task 3 - AWS Lambda-based Product Service built with AWS CDK, API Gateway and Node.js.

## Deployed API

Base URL: `https://r9rcu7ik4b.execute-api.eu-central-1.amazonaws.com/prod`

Products: `https://r9rcu7ik4b.execute-api.eu-central-1.amazonaws.com/prod/products`

Product by id: `https://r9rcu7ik4b.execute-api.eu-central-1.amazonaws.com/prod/products/1`

## Product Schema

```typescript
type Product = {
  id: string;          // Unique identifier
  title: string;       // Product name
  description: string; // Product description
  price: number;       // Price in USD
  count: number;       // Available stock
}

## Deployment

- **CloudFront URL:** d2mj199qwf9cum.cloudfront.net 
- **S3 Bucket:** infrastack-spabucket48e1059f-oi7f5twqkpu2.s3.eu-central-1.amazonaws.com

## Deploy

```bash
npm install
cdk deploy --profile cdk-deploy
