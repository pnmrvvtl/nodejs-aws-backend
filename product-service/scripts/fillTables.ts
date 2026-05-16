import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({ region: "eu-central-1" });
const documentClient = DynamoDBDocumentClient.from(client);

const productsTableName = "products";
const stocksTableName = "stocks";

const products = [
  {
    id: randomUUID(),
    title: "Laptop Pro 14",
    description: "Compact laptop for everyday development work",
    price: 1800,
    count: 7,
  },
  {
    id: randomUUID(),
    title: "Wireless Mouse",
    description: "Ergonomic mouse with quiet buttons",
    price: 45,
    count: 24,
  },
  {
    id: randomUUID(),
    title: "Mechanical Keyboard",
    description: "Hot-swappable keyboard with tactile switches",
    price: 120,
    count: 12,
  },
  {
    id: randomUUID(),
    title: "USB-C Hub",
    description: "Multiport adapter with HDMI and Ethernet",
    price: 65,
    count: 18,
  },
];

async function fillTables(): Promise<void> {
  for (const product of products) {
    const { count, ...productItem } = product;

    await documentClient.send(
      new PutCommand({
        TableName: productsTableName,
        Item: productItem,
      }),
    );

    await documentClient.send(
      new PutCommand({
        TableName: stocksTableName,
        Item: {
          product_id: product.id,
          count,
        },
      }),
    );
  }
}

fillTables()
  .then(() => {
    console.log("Tables were filled successfully");
  })
  .catch((error: unknown) => {
    console.error("Failed to fill tables", error);
    process.exit(1);
  });
