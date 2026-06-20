import { APIGatewayProxyHandler } from "aws-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getRequiredEnv } from "../utils/env";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

const client = new S3Client({});

function isValidFileName(name: string | undefined): name is string {
  return typeof name === "string" && name.trim().length > 0;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("importProductsFile request", {
    path: event.path,
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
  });

  try {
    const fileName = event.queryStringParameters?.name;

    if (!isValidFileName(fileName)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "File name is required" }),
      };
    }

    const bucketName = getRequiredEnv("IMPORT_BUCKET_NAME");
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `uploaded/${fileName}`,
      ContentType: "text/csv",
    });
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(signedUrl),
    };
  } catch (error: unknown) {
    console.error("Failed to create signed URL", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
