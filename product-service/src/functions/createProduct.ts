import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import {
  isCreateProductRequest,
  ProductResponse,
} from "../models/product";
import { getRequiredEnv } from "../utils/env";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);

function parseBody(body: string | null): unknown {
  if (!body) {
    return null;
  }

  return JSON.parse(body);
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("createProduct request", {
    path: event.path,
    httpMethod: event.httpMethod,
    body: event.body,
  });

  try {
    const parsedBody = parseBody(event.body);

    if (!isCreateProductRequest(parsedBody)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Invalid product data" }),
      };
    }

    const productsTable = getRequiredEnv("PRODUCTS_TABLE");
    const stocksTable = getRequiredEnv("STOCKS_TABLE");
    const id = randomUUID();

    const product: ProductResponse = {
      id,
      title: parsedBody.title,
      description: parsedBody.description,
      price: parsedBody.price,
      count: parsedBody.count,
    };

    await documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: productsTable,
              Item: {
                id: product.id,
                title: product.title,
                description: product.description,
                price: product.price,
              },
            },
          },
          {
            Put: {
              TableName: stocksTable,
              Item: {
                product_id: product.id,
                count: product.count,
              },
            },
          },
        ],
      }),
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(product),
    };
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Invalid JSON body" }),
      };
    }

    console.error("Failed to create product", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
