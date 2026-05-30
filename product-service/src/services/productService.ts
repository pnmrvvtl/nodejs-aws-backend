import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { CreateProductRequest, ProductResponse } from "../models/product";

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);

export async function createProductItem(
  productRequest: CreateProductRequest,
  productsTable: string,
  stocksTable: string,
): Promise<ProductResponse> {
  const product: ProductResponse = {
    id: randomUUID(),
    title: productRequest.title,
    description: productRequest.description,
    price: productRequest.price,
    count: productRequest.count,
  };

  await documentClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: productsTable,
            Item: {
              id: product.id,
              title: product.title,
              description: product.description,
              price: product.price,
            },
          },
        },
        {
          Put: {
            TableName: stocksTable,
            Item: {
              product_id: product.id,
              count: product.count,
            },
          },
        },
      ],
    }),
  );

  return product;
}
