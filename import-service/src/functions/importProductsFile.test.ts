import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";

const mockGetSignedUrl = jest.fn<Promise<string>, [unknown, unknown, unknown]>();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({})),
  PutObjectCommand: jest.fn((input: unknown) => ({ input })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { handler } from "./importProductsFile";

const mockContext = {} as Context;

function createEvent(name?: string): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/import",
    pathParameters: null,
    queryStringParameters: name === undefined ? null : { name },
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "/import",
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

describe("importProductsFile", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    process.env.IMPORT_BUCKET_NAME = "rs-back-import";
    mockGetSignedUrl.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("returns signed URL and status 200", async () => {
    mockGetSignedUrl.mockResolvedValue("https://signed-url.example");

    const result = await callHandler(createEvent("products.csv"));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toBe("https://signed-url.example");
  });

  test("creates signed URL for uploaded file key", async () => {
    mockGetSignedUrl.mockResolvedValue("https://signed-url.example");

    await callHandler(createEvent("products.csv"));

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      {
        input: {
          Bucket: "rs-back-import",
          Key: "uploaded/products.csv",
          ContentType: "text/csv",
        },
      },
      { expiresIn: 60 },
    );
  });

  test("returns 400 when file name is missing", async () => {
    const result = await callHandler(createEvent());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "File name is required",
    });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  test("returns 400 when file name is empty", async () => {
    const result = await callHandler(createEvent(""));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "File name is required",
    });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  test("returns 500 when signing fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      mockGetSignedUrl.mockRejectedValue(new Error("S3 failed"));

      const result = await callHandler(createEvent("products.csv"));

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: "Internal server error",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to create signed URL",
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
