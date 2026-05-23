import { APIGatewayProxyHandler } from "aws-lambda";
import { isCreateProductRequest } from "../models/product";
import { createProductItem } from "../services/productService";
import { getRequiredEnv } from "../utils/env";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

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

    const product = await createProductItem(
      parsedBody,
      productsTable,
      stocksTable,
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
