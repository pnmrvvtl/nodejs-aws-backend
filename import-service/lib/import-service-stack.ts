import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3Notifications from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as path from "path";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const importBucket = s3.Bucket.fromBucketName(
      this,
      "ImportBucket",
      "rs-back-import",
    );

    const catalogItemsQueueUrl = cdk.Fn.sub(
      "https://sqs.${AWS::Region}.${AWS::URLSuffix}/${AWS::AccountId}/catalogItemsQueue",
    );

    const catalogItemsQueue = sqs.Queue.fromQueueAttributes(
      this,
      "catalogItemsQueue",
      {
        queueArn: cdk.Stack.of(this).formatArn({
          service: "sqs",
          resource: "catalogItemsQueue",
        }),
        queueUrl: catalogItemsQueueUrl,
      },
    );

    const importProductsFile = new nodejs.NodejsFunction(
      this,
      "importProductsFile",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(
          __dirname,
          "../src/functions/importProductsFile.ts",
        ),
        handler: "handler",
        environment: {
          IMPORT_BUCKET_NAME: importBucket.bucketName,
        },
      },
    );

    importBucket.grantPut(importProductsFile, "uploaded/*");

    const importFileParser = new nodejs.NodejsFunction(
      this,
      "importFileParser",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, "../src/functions/importFileParser.ts"),
        handler: "handler",
        environment: {
          CATALOG_ITEMS_QUEUE_URL: catalogItemsQueueUrl,
        },
      },
    );

    importBucket.grantRead(importFileParser, "uploaded/*");
    importBucket.grantDelete(importFileParser, "uploaded/*");
    importBucket.grantPut(importFileParser, "parsed/*");
    catalogItemsQueue.grantSendMessages(importFileParser);

    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.LambdaDestination(importFileParser),
      {
        prefix: "uploaded/",
      },
    );

    const api = new apigateway.RestApi(this, "ImportServiceApi", {
      restApiName: "Import Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const importResource = api.root.addResource("import");
    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFile),
      {
        requestParameters: {
          "method.request.querystring.name": true,
        },
      },
    );

    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });

    new cdk.CfnOutput(this, "ImportBucketName", {
      value: importBucket.bucketName,
    });
    new cdk.CfnOutput(this, "CatalogItemsQueueUrl", {
      value: catalogItemsQueueUrl,
    });
  }
}
