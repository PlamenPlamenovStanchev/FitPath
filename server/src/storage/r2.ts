import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { serverEnv } from "../config/env.js";
import { assertPrivateObjectKey } from "./object-keys.js";

const r2Client = new S3Client({
  region: "auto",
  endpoint: serverEnv.r2Endpoint,
  credentials: {
    accessKeyId: serverEnv.r2AccessKeyId,
    secretAccessKey: serverEnv.r2SecretAccessKey,
  },
});

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

  await r2Client.send(
    new PutObjectCommand({
      Bucket: serverEnv.r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string): Promise<Buffer> {
  assertPrivateObjectKey(key);

  const result = await r2Client.send(
    new GetObjectCommand({
      Bucket: serverEnv.r2BucketName,
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

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: serverEnv.r2BucketName,
      Key: key,
    }),
  );
}
