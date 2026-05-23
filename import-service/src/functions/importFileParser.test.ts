import { Context, S3Event } from "aws-lambda";
import { Readable } from "stream";

const mockS3Send = jest.fn<Promise<unknown>, [unknown]>();
const mockSqsSend = jest.fn<Promise<unknown>, [unknown]>();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({
    send: mockS3Send,
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

jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: jest.fn(() => ({
    send: mockSqsSend,
  })),
  SendMessageCommand: jest.fn((input: unknown) => ({
    command: "SendMessage",
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

function createBomCsvStream(): Readable {
  return Readable.from([
    "\uFEFFtitle,description,price,count\n",
    "Wireless Mouse,Ergonomic bluetooth mouse,25,12\n",
  ]);
}

describe("importFileParser", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    process.env.CATALOG_ITEMS_QUEUE_URL = "https://sqs.example/catalogItemsQueue";
    mockS3Send.mockReset();
    mockSqsSend.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("reads uploaded CSV, copies to parsed, and deletes original", async () => {
    mockS3Send
      .mockResolvedValueOnce({ Body: createCsvStream() })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    mockSqsSend.mockResolvedValue({});

    await handler(
      createEvent("uploaded/products.csv"),
      mockContext,
      () => undefined,
    );

    expect(mockS3Send).toHaveBeenNthCalledWith(1, {
      command: "GetObject",
      input: {
        Bucket: "rs-back-import",
        Key: "uploaded/products.csv",
      },
    });
    expect(mockS3Send).toHaveBeenNthCalledWith(2, {
      command: "CopyObject",
      input: {
        Bucket: "rs-back-import",
        CopySource: "rs-back-import/uploaded/products.csv",
        Key: "parsed/products.csv",
      },
    });
    expect(mockS3Send).toHaveBeenNthCalledWith(3, {
      command: "DeleteObject",
      input: {
        Bucket: "rs-back-import",
        Key: "uploaded/products.csv",
      },
    });
  });

  test("sends parsed CSV rows to SQS", async () => {
    mockS3Send
      .mockResolvedValueOnce({ Body: createCsvStream() })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    mockSqsSend.mockResolvedValue({});

    await handler(
      createEvent("uploaded/products.csv"),
      mockContext,
      () => undefined,
    );

    expect(mockSqsSend).toHaveBeenCalledTimes(2);
    expect(mockSqsSend).toHaveBeenCalledWith({
      command: "SendMessage",
      input: {
        QueueUrl: "https://sqs.example/catalogItemsQueue",
        MessageBody: JSON.stringify({
          title: "Wireless Mouse",
          description: "Ergonomic bluetooth mouse",
          price: "25",
          count: "12",
        }),
      },
    });
    expect(mockSqsSend).toHaveBeenCalledWith({
      command: "SendMessage",
      input: {
        QueueUrl: "https://sqs.example/catalogItemsQueue",
        MessageBody: JSON.stringify({
          title: "USB-C Hub",
          description: "Seven port aluminum USB-C hub",
          price: "49",
          count: "8",
        }),
      },
    });
  });

  test("normalizes BOM in CSV headers", async () => {
    mockS3Send
      .mockResolvedValueOnce({ Body: createBomCsvStream() })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    mockSqsSend.mockResolvedValue({});

    await handler(
      createEvent("uploaded/products.csv"),
      mockContext,
      () => undefined,
    );

    expect(mockSqsSend).toHaveBeenCalledWith({
      command: "SendMessage",
      input: {
        QueueUrl: "https://sqs.example/catalogItemsQueue",
        MessageBody: JSON.stringify({
          title: "Wireless Mouse",
          description: "Ergonomic bluetooth mouse",
          price: "25",
          count: "12",
        }),
      },
    });
  });

  test("decodes URL encoded S3 object key", async () => {
    mockS3Send
      .mockResolvedValueOnce({ Body: createCsvStream() })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    mockSqsSend.mockResolvedValue({});

    await handler(
      createEvent("uploaded/products+with+spaces.csv"),
      mockContext,
      () => undefined,
    );

    expect(mockS3Send).toHaveBeenNthCalledWith(1, {
      command: "GetObject",
      input: {
        Bucket: "rs-back-import",
        Key: "uploaded/products with spaces.csv",
      },
    });
    expect(mockS3Send).toHaveBeenNthCalledWith(2, {
      command: "CopyObject",
      input: {
        Bucket: "rs-back-import",
        CopySource: "rs-back-import/uploaded/products with spaces.csv",
        Key: "parsed/products with spaces.csv",
      },
    });
  });

  test("rejects when S3 object body is not a readable stream", async () => {
    mockS3Send.mockResolvedValueOnce({ Body: "not-stream" });

    await expect(
      handler(createEvent("uploaded/products.csv"), mockContext, () => undefined),
    ).rejects.toThrow("S3 object body is not a readable stream");
  });
});
