import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

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

    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductsById);
    stocksTable.grantReadData(getProductsById);

    productsTable.grantWriteData(createProduct);
    stocksTable.grantWriteData(createProduct);

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
  }
}
