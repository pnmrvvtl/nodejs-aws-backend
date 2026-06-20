import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const productsTable = dynamodb.Table.fromTableName(
      this,
      "ProductsTable",
      "products",
    );

    const stocksTable = dynamodb.Table.fromTableName(
      this,
      "StocksTable",
      "stocks",
    );

    const catalogItemsQueue = new sqs.Queue(this, "catalogItemsQueue", {
      queueName: "catalogItemsQueue",
    });

    const createProductTopic = new sns.Topic(this, "createProductTopic", {
      topicName: "createProductTopic",
    });

    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription("pnmrv.vtl@gmail.com", {
        filterPolicy: {
          priceCategory: sns.SubscriptionFilter.stringFilter({
            allowlist: ["regular"],
          }),
        },
      }),
    );

    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription("pnmrv.vtl+expensive@gmail.com", {
        filterPolicy: {
          priceCategory: sns.SubscriptionFilter.stringFilter({
            allowlist: ["expensive"],
          }),
        },
      }),
    );

    const getProductsList = new nodejs.NodejsFunction(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../src/functions/getProductsList.ts"),
      handler: "handler",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    const getProductsById = new nodejs.NodejsFunction(this, "getProductsById", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../src/functions/getProductsById.ts"),
      handler: "handler",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    const createProduct = new nodejs.NodejsFunction(this, "createProduct", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../src/functions/createProduct.ts"),
      handler: "handler",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    const catalogBatchProcess = new nodejs.NodejsFunction(
      this,
      "catalogBatchProcess",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(
          __dirname,
          "../src/functions/catalogBatchProcess.ts",
        ),
        handler: "handler",
        environment: {
          PRODUCTS_TABLE: productsTable.tableName,
          STOCKS_TABLE: stocksTable.tableName,
          CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
        },
      },
    );

    catalogBatchProcess.addEventSource(
      new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
      }),
    );

    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductsById);
    stocksTable.grantReadData(getProductsById);

    productsTable.grantWriteData(createProduct);
    stocksTable.grantWriteData(createProduct);

    productsTable.grantWriteData(catalogBatchProcess);
    stocksTable.grantWriteData(catalogBatchProcess);
    const transactWritePolicy = new iam.PolicyStatement({
      actions: ["dynamodb:TransactWriteItems"],
      resources: [productsTable.tableArn, stocksTable.tableArn],
    });
    createProduct.addToRolePolicy(transactWritePolicy);
    catalogBatchProcess.addToRolePolicy(transactWritePolicy);
    catalogItemsQueue.grantConsumeMessages(catalogBatchProcess);
    createProductTopic.grantPublish(catalogBatchProcess);

    const api = new apigateway.RestApi(this, "ProductServiceApi", {
      restApiName: "Product Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const products = api.root.addResource("products");
    products.addMethod("GET", new apigateway.LambdaIntegration(getProductsList));
    products.addMethod("POST", new apigateway.LambdaIntegration(createProduct));

    const product = products.addResource("{productId}");
    product.addMethod("GET", new apigateway.LambdaIntegration(getProductsById));

    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
    new cdk.CfnOutput(this, "CatalogItemsQueueUrl", {
      value: catalogItemsQueue.queueUrl,
    });
    new cdk.CfnOutput(this, "CatalogItemsQueueArn", {
      value: catalogItemsQueue.queueArn,
    });
    new cdk.CfnOutput(this, "CreateProductTopicArn", {
      value: createProductTopic.topicArn,
    });
  }
}
