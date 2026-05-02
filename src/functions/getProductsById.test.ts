import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { handler } from "./getProductsById";
import { products } from "../products/products";

const mockContext = {} as Context;

const mockEvent = (productId: string): APIGatewayProxyEvent =>
  ({ pathParameters: { productId } } as unknown as APIGatewayProxyEvent);

test("returns product by existing id", async () => {
  const result = await handler(mockEvent("1"), mockContext, () => {}) as APIGatewayProxyResult;
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toEqual(products[0]);
});

test("returns 404 for non-existing id", async () => {
  const result = await handler(mockEvent("999"), mockContext, () => {}) as APIGatewayProxyResult;
  expect(result.statusCode).toBe(404);
  expect(JSON.parse(result.body)).toEqual({ message: "Product not found" });
});

test("returns 404 when pathParameters is empty", async () => {
  const event = { pathParameters: {} } as unknown as APIGatewayProxyEvent;
  const result = await handler(event, mockContext, () => {}) as APIGatewayProxyResult;
  expect(result.statusCode).toBe(404);
});
