import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

const mockSend = jest.fn<Promise<unknown>, [unknown]>();
const mockRandomUUID = jest.fn(() => "generated-product-id");

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  TransactWriteCommand: jest.fn((input: unknown) => ({ input })),
}));

jest.mock("crypto", () => ({
  randomUUID: mockRandomUUID,
}));

import { handler } from "./createProduct";

const mockContext = {} as Context;

function createEvent(body: string | null): APIGatewayProxyEvent {
  return {
    body,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "POST",
    isBase64Encoded: false,
    path: "/products",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "/products",
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

describe("createProduct", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    process.env.PRODUCTS_TABLE = "products";
    process.env.STOCKS_TABLE = "stocks";
    mockSend.mockReset();
    mockRandomUUID.mockReturnValue("generated-product-id");
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("returns created product and status 201", async () => {
    mockSend.mockResolvedValue({});

    const result = await callHandler(
      createEvent(
        JSON.stringify({
          title: "Monitor Stand",
          description: "Aluminum desk stand",
          price: 80,
          count: 10,
        }),
      ),
    );

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({
      id: "generated-product-id",
      title: "Monitor Stand",
      description: "Aluminum desk stand",
      price: 80,
      count: 10,
    });
  });

  test("writes product and stock using transaction", async () => {
    mockSend.mockResolvedValue({});

    await callHandler(
      createEvent(
        JSON.stringify({
          title: "Monitor Stand",
          description: "Aluminum desk stand",
          price: 80,
          count: 10,
        }),
      ),
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      input: {
        TransactItems: [
          {
            Put: {
              TableName: "products",
              Item: {
                id: "generated-product-id",
                title: "Monitor Stand",
                description: "Aluminum desk stand",
                price: 80,
              },
            },
          },
          {
            Put: {
              TableName: "stocks",
              Item: {
                product_id: "generated-product-id",
                count: 10,
              },
            },
          },
        ],
      },
    });
  });

  test("returns 400 when body is missing", async () => {
    const result = await callHandler(createEvent(null));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Invalid product data",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("returns 400 when body is invalid JSON", async () => {
    const result = await callHandler(createEvent("{invalid-json"));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Invalid JSON body",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("returns 400 when title is empty", async () => {
    const result = await callHandler(
      createEvent(
        JSON.stringify({
          title: "",
          description: "Aluminum desk stand",
          price: 80,
          count: 10,
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Invalid product data",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("returns 400 when price is invalid", async () => {
    const result = await callHandler(
      createEvent(
        JSON.stringify({
          title: "Monitor Stand",
          description: "Aluminum desk stand",
          price: -1,
          count: 10,
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Invalid product data",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("returns 400 when count is invalid", async () => {
    const result = await callHandler(
      createEvent(
        JSON.stringify({
          title: "Monitor Stand",
          description: "Aluminum desk stand",
          price: 80,
          count: 1.5,
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Invalid product data",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test("returns correct headers", async () => {
    mockSend.mockResolvedValue({});

    const result = await callHandler(
      createEvent(
        JSON.stringify({
          title: "Monitor Stand",
          description: "Aluminum desk stand",
          price: 80,
          count: 10,
        }),
      ),
    );

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

      const result = await callHandler(
        createEvent(
          JSON.stringify({
            title: "Monitor Stand",
            description: "Aluminum desk stand",
            price: 80,
            count: 10,
          }),
        ),
      );

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: "Internal server error",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create product",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
