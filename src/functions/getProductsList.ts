import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  isProductItem,
  isStockItem,
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

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("getProductsList request", {
    path: event.path,
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
  });

  try {
    const productsTable = getRequiredEnv("PRODUCTS_TABLE");
    const stocksTable = getRequiredEnv("STOCKS_TABLE");

    const [productsResult, stocksResult] = await Promise.all([
      documentClient.send(
        new ScanCommand({
          TableName: productsTable,
        }),
      ),
      documentClient.send(
        new ScanCommand({
          TableName: stocksTable,
        }),
      ),
    ]);

    const productItems = (productsResult.Items ?? []).filter(isProductItem);
    const stockItems = (stocksResult.Items ?? []).filter(isStockItem);

    const stockByProductId = new Map(
      stockItems.map((stock) => [stock.product_id, stock.count]),
    );

    const response: ProductResponse[] = productItems.map((product) => ({
      ...product,
      count: stockByProductId.get(product.id) ?? 0,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    console.error("Failed to get products list", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
