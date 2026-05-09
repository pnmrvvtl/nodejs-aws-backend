import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

const mockSend = jest.fn<Promise<{ Items?: unknown[] }>, [unknown]>();

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  ScanCommand: jest.fn((input: unknown) => ({ input })),
}));

import { handler } from "./getProductsList";

const mockEvent = {} as APIGatewayProxyEvent;
const mockContext = {} as Context;

async function callHandler(): Promise<APIGatewayProxyResult> {
  const result = await handler(mockEvent, mockContext, () => undefined);

  if (!result) {
    throw new Error("Handler did not return a result");
  }

  return result as APIGatewayProxyResult;
}

describe("getProductsList", () => {
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

  test("returns products with stock count and status 200", async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: [
          {
            id: "product-1",
            title: "Laptop Pro 14",
            description: "Compact laptop",
            price: 1800,
          },
          {
            id: "product-2",
            title: "Wireless Mouse",
            description: "Ergonomic mouse",
            price: 45,
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [
          {
            product_id: "product-1",
            count: 7,
          },
          {
            product_id: "product-2",
            count: 24,
          },
        ],
      });

    const result = await callHandler();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([
      {
        id: "product-1",
        title: "Laptop Pro 14",
        description: "Compact laptop",
        price: 1800,
        count: 7,
      },
      {
        id: "product-2",
        title: "Wireless Mouse",
        description: "Ergonomic mouse",
        price: 45,
        count: 24,
      },
    ]);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  test("uses count 0 when product has no stock item", async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: [
          {
            id: "product-1",
            title: "Laptop Pro 14",
            description: "Compact laptop",
            price: 1800,
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [],
      });

    const result = await callHandler();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([
      {
        id: "product-1",
        title: "Laptop Pro 14",
        description: "Compact laptop",
        price: 1800,
        count: 0,
      },
    ]);
  });

  test("returns correct headers", async () => {
    mockSend.mockResolvedValue({ Items: [] });

    const result = await callHandler();

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

      const result = await callHandler();

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: "Internal server error",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to get products list",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
