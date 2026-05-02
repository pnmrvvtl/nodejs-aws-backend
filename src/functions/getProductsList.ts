import { APIGatewayProxyHandler } from "aws-lambda";
import { products } from "../products/products";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

export const handler: APIGatewayProxyHandler = async () => {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(products),
  };
};
