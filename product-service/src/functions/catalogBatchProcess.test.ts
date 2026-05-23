import { Context, SQSEvent } from "aws-lambda";
import { CreateProductRequest, ProductResponse } from "../models/product";

const mockSnsSend = jest.fn<Promise<unknown>, [unknown]>();
const mockCreateProductItem = jest.fn<
  Promise<ProductResponse>,
  [CreateProductRequest, string, string]
>();

jest.mock("@aws-sdk/client-sns", () => ({
  SNSClient: jest.fn(() => ({
    send: mockSnsSend,
  })),
  PublishCommand: jest.fn((input: unknown) => ({
    command: "Publish",
    input,
  })),
}));

jest.mock("../services/productService", () => ({
  createProductItem: mockCreateProductItem,
}));

import { handler } from "./catalogBatchProcess";

const mockContext = {} as Context;

function createEvent(messages: unknown[]): SQSEvent {
  return {
    Records: messages.map((message, index) => ({
      messageId: `message-${index}`,
      receiptHandle: `receipt-${index}`,
      body: JSON.stringify(message),
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "1",
        SenderId: "sender",
        ApproximateFirstReceiveTimestamp: "1",
      },
      messageAttributes: {},
      md5OfBody: "md5",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:eu-central-1:123456789012:catalogItemsQueue",
      awsRegion: "eu-central-1",
    })),
  };
}

describe("catalogBatchProcess", () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    process.env.PRODUCTS_TABLE = "products";
    process.env.STOCKS_TABLE = "stocks";
    process.env.CREATE_PRODUCT_TOPIC_ARN =
      "arn:aws:sns:eu-central-1:123456789012:createProductTopic";
    mockSnsSend.mockReset();
    mockCreateProductItem.mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test("creates products from SQS messages", async () => {
    mockCreateProductItem
      .mockResolvedValueOnce({
        id: "product-1",
        title: "Wireless Mouse",
        description: "Ergonomic bluetooth mouse",
        price: 25,
        count: 12,
      })
      .mockResolvedValueOnce({
        id: "product-2",
        title: "Desk Chair",
        description: "Adjustable office chair",
        price: 120,
        count: 3,
      });
    mockSnsSend.mockResolvedValue({});

    await handler(
      createEvent([
        {
          title: "Wireless Mouse",
          description: "Ergonomic bluetooth mouse",
          price: "25",
          count: "12",
        },
        {
          title: "Desk Chair",
          description: "Adjustable office chair",
          price: "120",
          count: "3",
        },
      ]),
      mockContext,
      () => undefined,
    );

    expect(mockCreateProductItem).toHaveBeenNthCalledWith(
      1,
      {
        title: "Wireless Mouse",
        description: "Ergonomic bluetooth mouse",
        price: 25,
        count: 12,
      },
      "products",
      "stocks",
    );
    expect(mockCreateProductItem).toHaveBeenNthCalledWith(
      2,
      {
        title: "Desk Chair",
        description: "Adjustable office chair",
        price: 120,
        count: 3,
      },
      "products",
      "stocks",
    );
  });

  test("publishes SNS event with filter attributes", async () => {
    mockCreateProductItem
      .mockResolvedValueOnce({
        id: "product-1",
        title: "Wireless Mouse",
        description: "Ergonomic bluetooth mouse",
        price: 25,
        count: 12,
      })
      .mockResolvedValueOnce({
        id: "product-2",
        title: "Desk Chair",
        description: "Adjustable office chair",
        price: 120,
        count: 3,
      });
    mockSnsSend.mockResolvedValue({});

    await handler(
      createEvent([
        {
          title: "Wireless Mouse",
          description: "Ergonomic bluetooth mouse",
          price: "25",
          count: "12",
        },
        {
          title: "Desk Chair",
          description: "Adjustable office chair",
          price: "120",
          count: "3",
        },
      ]),
      mockContext,
      () => undefined,
    );

    expect(mockSnsSend).toHaveBeenNthCalledWith(1, {
      command: "Publish",
      input: {
        TopicArn: "arn:aws:sns:eu-central-1:123456789012:createProductTopic",
        Subject: "Product created from CSV import",
        Message: JSON.stringify({
          id: "product-1",
          title: "Wireless Mouse",
          description: "Ergonomic bluetooth mouse",
          price: 25,
          count: 12,
        }),
        MessageAttributes: {
          priceCategory: {
            DataType: "String",
            StringValue: "regular",
          },
        },
      },
    });
    expect(mockSnsSend).toHaveBeenNthCalledWith(2, {
      command: "Publish",
      input: {
        TopicArn: "arn:aws:sns:eu-central-1:123456789012:createProductTopic",
        Subject: "Product created from CSV import",
        Message: JSON.stringify({
          id: "product-2",
          title: "Desk Chair",
          description: "Adjustable office chair",
          price: 120,
          count: 3,
        }),
        MessageAttributes: {
          priceCategory: {
            DataType: "String",
            StringValue: "expensive",
          },
        },
      },
    });
  });

  test("skips invalid product message", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      await handler(
        createEvent([
          {
            title: "",
            description: "Missing title",
            price: "25",
            count: "12",
          },
        ]),
        mockContext,
        () => undefined,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }

    expect(mockCreateProductItem).not.toHaveBeenCalled();
    expect(mockSnsSend).not.toHaveBeenCalled();
  });
});
