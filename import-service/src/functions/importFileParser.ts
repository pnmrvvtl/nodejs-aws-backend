import { S3Event, S3Handler } from "aws-lambda";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import csvParser from "csv-parser";
import { Readable } from "stream";
import { getRequiredEnv } from "../utils/env";

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

type CsvRecord = Record<string, string>;

function isReadableStream(body: unknown): body is Readable {
  return body instanceof Readable;
}

function parseCsvStream(stream: Readable): Promise<CsvRecord[]> {
  return new Promise((resolve, reject) => {
    const records: CsvRecord[] = [];

    stream
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => header.replace(/^\uFEFF/, "").trim(),
          mapValues: ({ value }) => value.trim(),
        }),
      )
      .on("data", (record: CsvRecord) => {
        records.push(record);
      })
      .on("end", () => resolve(records))
      .on("error", reject);
  });
}

function getDecodedKey(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, " "));
}

async function sendRecordToQueue(
  record: CsvRecord,
  queueUrl: string,
): Promise<void> {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(record),
    }),
  );
}

async function processRecord(record: S3Event["Records"][number]): Promise<void> {
  const bucketName = record.s3.bucket.name;
  const objectKey = getDecodedKey(record.s3.object.key);
  const parsedKey = objectKey.replace(/^uploaded\//, "parsed/");
  const queueUrl = getRequiredEnv("CATALOG_ITEMS_QUEUE_URL");

  const object = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  if (!isReadableStream(object.Body)) {
    throw new Error("S3 object body is not a readable stream");
  }

  const records = await parseCsvStream(object.Body);

  await Promise.all(
    records.map((csvRecord) => sendRecordToQueue(csvRecord, queueUrl)),
  );

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${objectKey}`,
      Key: parsedKey,
    }),
  );

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );
}

export const handler: S3Handler = async (event) => {
  console.log("importFileParser event", JSON.stringify(event));

  await Promise.all(event.Records.map(processRecord));
};
