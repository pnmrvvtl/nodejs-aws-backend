import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const githubLogin = "pnmrvvtl";
    const password = process.env[githubLogin];

    if (!password) {
      throw new Error(`Missing ${githubLogin} environment variable`);
    }

    const basicAuthorizer = new nodejs.NodejsFunction(this, "basicAuthorizer", {
      functionName: "basicAuthorizer",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../src/functions/basicAuthorizer.ts"),
      handler: "handler",
      environment: {
        [githubLogin]: password,
      },
    });

    new cdk.CfnOutput(this, "BasicAuthorizerArn", {
      value: basicAuthorizer.functionArn,
    });
  }
}
