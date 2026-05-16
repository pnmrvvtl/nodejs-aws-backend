import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { isProductItem, isStockItem, ProductResponse } from "../models/product";
import { getRequiredEnv } from "../utils/env";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("getProductsById request", {
    path: event.path,
    httpMethod: event.httpMethod,
    pathParameters: event.pathParameters,
  });

  try {
    const productId = event.pathParameters?.productId;

    if (!productId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Product id is required" }),
      };
    }

    const productsTable = getRequiredEnv("PRODUCTS_TABLE");
    const stocksTable = getRequiredEnv("STOCKS_TABLE");

    const [productResult, stockResult] = await Promise.all([
      documentClient.send(
        new GetCommand({
          TableName: productsTable,
          Key: {
            id: productId,
          },
        }),
      ),
      documentClient.send(
        new GetCommand({
          TableName: stocksTable,
          Key: {
            product_id: productId,
          },
        }),
      ),
    ]);

    if (!isProductItem(productResult.Item)) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    const count = isStockItem(stockResult.Item) ? stockResult.Item.count : 0;

    const response: ProductResponse = {
      ...productResult.Item,
      count,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    console.error("Failed to get product by id", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
