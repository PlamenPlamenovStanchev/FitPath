import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { requireR2Environment } from "../config/env.js";
import { assertPrivateObjectKey } from "./object-keys.js";

let r2Storage: { client: S3Client; bucketName: string } | null = null;

function getR2Storage() {
  const r2Environment = requireR2Environment();

  if (!r2Storage) {
    r2Storage = {
      client: new S3Client({
        region: "auto",
        endpoint: r2Environment.endpoint,
        credentials: {
          accessKeyId: r2Environment.accessKeyId,
          secretAccessKey: r2Environment.secretAccessKey,
        },
      }),
      bucketName: r2Environment.bucketName,
    };
  }

  return r2Storage;
}

type UploadObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export async function uploadObject({
  key,
  body,
  contentType,
}: UploadObjectInput): Promise<void> {
  assertPrivateObjectKey(key);

  if (!contentType.trim()) {
    throw new Error("Content type is required");
  }

  const { client, bucketName } = getR2Storage();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string): Promise<Buffer> {
  assertPrivateObjectKey(key);
  const { client, bucketName } = getR2Storage();

  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error("Storage object response did not include a body");
  }

  return Buffer.from(await result.Body.transformToByteArray());
}

export async function deleteObject(key: string): Promise<void> {
  assertPrivateObjectKey(key);
  const { client, bucketName } = getR2Storage();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}
