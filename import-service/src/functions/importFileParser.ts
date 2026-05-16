import { S3Event, S3Handler } from "aws-lambda";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import csvParser from "csv-parser";
import { Readable } from "stream";

const client = new S3Client({});

type CsvRecord = Record<string, string>;

function isReadableStream(body: unknown): body is Readable {
  return body instanceof Readable;
}

function parseCsvStream(stream: Readable): Promise<CsvRecord[]> {
  return new Promise((resolve, reject) => {
    const records: CsvRecord[] = [];

    stream
      .pipe(csvParser())
      .on("data", (record: CsvRecord) => {
        console.log("CSV record", record);
        records.push(record);
      })
      .on("end", () => resolve(records))
      .on("error", reject);
  });
}

function getDecodedKey(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, " "));
}

async function processRecord(record: S3Event["Records"][number]): Promise<void> {
  const bucketName = record.s3.bucket.name;
  const objectKey = getDecodedKey(record.s3.object.key);
  const parsedKey = objectKey.replace(/^uploaded\//, "parsed/");

  const object = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  if (!isReadableStream(object.Body)) {
    throw new Error("S3 object body is not a readable stream");
  }

  await parseCsvStream(object.Body);

  await client.send(
    new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${objectKey}`,
      Key: parsedKey,
    }),
  );

  await client.send(
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
