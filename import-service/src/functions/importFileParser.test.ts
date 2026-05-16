import { Context, S3Event } from "aws-lambda";
import { Readable } from "stream";

const mockSend = jest.fn<Promise<unknown>, [unknown]>();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({
    send: mockSend,
  })),
  GetObjectCommand: jest.fn((input: unknown) => ({ command: "GetObject", input })),
  CopyObjectCommand: jest.fn((input: unknown) => ({
    command: "CopyObject",
    input,
  })),
  DeleteObjectCommand: jest.fn((input: unknown) => ({
    command: "DeleteObject",
    input,
  })),
}));

import { handler } from "./importFileParser";

const mockContext = {} as Context;

function createEvent(key: string): S3Event {
  return {
    Records: [
      {
        eventVersion: "2.1",
        eventSource: "aws:s3",
        awsRegion: "eu-central-1",
        eventTime: "2026-05-16T00:00:00.000Z",
        eventName: "ObjectCreated:Put",
        userIdentity: {
          principalId: "principal",
        },
        requestParameters: {
          sourceIPAddress: "127.0.0.1",
        },
        responseElements: {
          "x-amz-request-id": "request-id",
          "x-amz-id-2": "id",
        },
        s3: {
          s3SchemaVersion: "1.0",
          configurationId: "configuration-id",
          bucket: {
            name: "rs-back-import",
            ownerIdentity: {
              principalId: "owner",
            },
            arn: "arn:aws:s3:::rs-back-import",
          },
          object: {
            key,
            size: 100,
            eTag: "etag",
            sequencer: "sequencer",
          },
        },
      },
    ],
  };
}

function createCsvStream(): Readable {
  return Readable.from([
    "title,description,price,count\n",
    "Wireless Mouse,Ergonomic bluetooth mouse,25,12\n",
    "USB-C Hub,Seven port aluminum USB-C hub,49,8\n",
  ]);
}

describe("importFileParser", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    mockSend.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("reads uploaded CSV, copies to parsed, and deletes original", async () => {
    mockSend
      .mockResolvedValueOnce({ Body: createCsvStream() })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await handler(
      createEvent("uploaded/products.csv"),
      mockContext,
      () => undefined,
    );

    expect(mockSend).toHaveBeenNthCalledWith(1, {
      command: "GetObject",
      input: {
        Bucket: "rs-back-import",
        Key: "uploaded/products.csv",
      },
    });
    expect(mockSend).toHaveBeenNthCalledWith(2, {
      command: "CopyObject",
      input: {
        Bucket: "rs-back-import",
        CopySource: "rs-back-import/uploaded/products.csv",
        Key: "parsed/products.csv",
      },
    });
    expect(mockSend).toHaveBeenNthCalledWith(3, {
      command: "DeleteObject",
      input: {
        Bucket: "rs-back-import",
        Key: "uploaded/products.csv",
      },
    });
  });

  test("logs parsed CSV rows", async () => {
    mockSend
      .mockResolvedValueOnce({ Body: createCsvStream() })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await handler(
      createEvent("uploaded/products.csv"),
      mockContext,
      () => undefined,
    );

    expect(consoleLogSpy).toHaveBeenCalledWith("CSV record", {
      title: "Wireless Mouse",
      description: "Ergonomic bluetooth mouse",
      price: "25",
      count: "12",
    });
    expect(consoleLogSpy).toHaveBeenCalledWith("CSV record", {
      title: "USB-C Hub",
      description: "Seven port aluminum USB-C hub",
      price: "49",
      count: "8",
    });
  });

  test("decodes URL encoded S3 object key", async () => {
    mockSend
      .mockResolvedValueOnce({ Body: createCsvStream() })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await handler(
      createEvent("uploaded/products+with+spaces.csv"),
      mockContext,
      () => undefined,
    );

    expect(mockSend).toHaveBeenNthCalledWith(1, {
      command: "GetObject",
      input: {
        Bucket: "rs-back-import",
        Key: "uploaded/products with spaces.csv",
      },
    });
    expect(mockSend).toHaveBeenNthCalledWith(2, {
      command: "CopyObject",
      input: {
        Bucket: "rs-back-import",
        CopySource: "rs-back-import/uploaded/products with spaces.csv",
        Key: "parsed/products with spaces.csv",
      },
    });
  });

  test("rejects when S3 object body is not a readable stream", async () => {
    mockSend.mockResolvedValueOnce({ Body: "not-stream" });

    await expect(
      handler(createEvent("uploaded/products.csv"), mockContext, () => undefined),
    ).rejects.toThrow("S3 object body is not a readable stream");
  });
});
