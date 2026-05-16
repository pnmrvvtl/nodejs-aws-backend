import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

const mockSend = jest.fn<Promise<{ Item?: unknown }>, [unknown]>();

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  GetCommand: jest.fn((input: unknown) => ({ input })),
}));

import { handler } from "./getProductsById";

const mockContext = {} as Context;

function createEvent(productId?: string): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: productId ? `/products/${productId}` : "/products",
    pathParameters: productId ? { productId } : null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "/products/{productId}",
  };
}

async function callHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const result = await handler(event, mockContext, () => undefined);

  if (!result) {
    throw new Error("Handler did not return a result");
  }

  return result as APIGatewayProxyResult;
}

describe("getProductsById", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    process.env.PRODUCTS_TABLE = "products";
    process.env.STOCKS_TABLE = "stocks";
    mockSend.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("returns product with stock count and status 200", async () => {
    mockSend
      .mockResolvedValueOnce({
        Item: {
          id: "product-1",
          title: "Laptop Pro 14",
          description: "Compact laptop",
          price: 1800,
        },
      })
      .mockResolvedValueOnce({
        Item: {
          product_id: "product-1",
          count: 7,
        },
      });

    const result = await callHandler(createEvent("product-1"));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      id: "product-1",
      title: "Laptop Pro 14",
      description: "Compact laptop",
      price: 1800,
      count: 7,
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  test("returns product with count 0 when stock is missing", async () => {
    mockSend
      .mockResolvedValueOnce({
        Item: {
          id: "product-1",
          title: "Laptop Pro 14",
          description: "Compact laptop",
          price: 1800,
        },
      })
      .mockResolvedValueOnce({});

    const result = await callHandler(createEvent("product-1"));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      id: "product-1",
      title: "Laptop Pro 14",
      description: "Compact laptop",
      price: 1800,
      count: 0,
    });
  });

  test("returns 404 when product is not found", async () => {
    mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({});

    const result = await callHandler(createEvent("missing-product"));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      message: "Product not found",
    });
  });

  test("returns 400 when product id is missing", async () => {
    const result = await callHandler(createEvent());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Product id is required",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("returns correct headers", async () => {
    mockSend
      .mockResolvedValueOnce({
        Item: {
          id: "product-1",
          title: "Laptop Pro 14",
          description: "Compact laptop",
          price: 1800,
        },
      })
      .mockResolvedValueOnce({
        Item: {
          product_id: "product-1",
          count: 7,
        },
      });

    const result = await callHandler(createEvent("product-1"));

    expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
    expect(result.headers?.["Access-Control-Allow-Headers"]).toBe("*");
    expect(result.headers?.["Content-Type"]).toBe("application/json");
  });

  test("returns 500 when DynamoDB request fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      mockSend.mockRejectedValue(new Error("DynamoDB failed"));

      const result = await callHandler(createEvent("product-1"));

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: "Internal server error",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to get product by id",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
