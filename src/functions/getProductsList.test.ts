import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { handler } from "./getProductsList";
import { products } from "../products/products";

const mockEvent = {} as APIGatewayProxyEvent;
const mockContext = {} as Context;

test("returns all products with status 200", async () => {
  const result = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toEqual(products);
});

test("returns correct headers", async () => {
  const result = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;
  expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
});
