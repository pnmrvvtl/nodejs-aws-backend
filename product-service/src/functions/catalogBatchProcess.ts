import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SQSEvent, SQSHandler } from "aws-lambda";
import { CreateProductRequest, ProductResponse } from "../models/product";
import { createProductItem } from "../services/productService";
import { getRequiredEnv } from "../utils/env";

const snsClient = new SNSClient({});

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseMessageBody(body: string): unknown {
  return JSON.parse(body);
}

function toCreateProductRequest(input: unknown): CreateProductRequest | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const product = input as Record<string, unknown>;
  const price = toNumber(product.price);
  const count = toNumber(product.count);

  if (
    typeof product.title !== "string" ||
    product.title.trim().length === 0 ||
    typeof product.description !== "string" ||
    product.description.trim().length === 0 ||
    price === null ||
    price <= 0 ||
    count === null ||
    !Number.isInteger(count) ||
    count < 0
  ) {
    return null;
  }

  return {
    title: product.title,
    description: product.description,
    price,
    count,
  };
}

function getPriceCategory(price: number): "regular" | "expensive" {
  return price >= 100 ? "expensive" : "regular";
}

async function publishCreatedProduct(
  product: ProductResponse,
  topicArn: string,
): Promise<void> {
  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: "Product created from CSV import",
      Message: JSON.stringify(product),
      MessageAttributes: {
        priceCategory: {
          DataType: "String",
          StringValue: getPriceCategory(product.price),
        },
      },
    }),
  );
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log("catalogBatchProcess event", {
    recordsCount: event.Records.length,
  });

  const productsTable = getRequiredEnv("PRODUCTS_TABLE");
  const stocksTable = getRequiredEnv("STOCKS_TABLE");
  const topicArn = getRequiredEnv("CREATE_PRODUCT_TOPIC_ARN");

  for (const record of event.Records) {
    const parsedBody = parseMessageBody(record.body);
    const productRequest = toCreateProductRequest(parsedBody);

    if (!productRequest) {
      console.error("Invalid product data in SQS message", {
        messageId: record.messageId,
        body: record.body,
      });
      continue;
    }

    const product = await createProductItem(
      productRequest,
      productsTable,
      stocksTable,
    );

    await publishCreatedProduct(product, topicArn);
  }
};
