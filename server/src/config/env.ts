import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), "../.env"), quiet: true });

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export const serverEnv = {
  port: Number(process.env.PORT ?? 3000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
};

export function requireDatabaseUrl(): string {
  if (!serverEnv.databaseUrl) {
    throw new Error("DATABASE_URL is required for database access");
  }

  return serverEnv.databaseUrl;
}

export type R2Environment = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
};

// R2 is optional for server startup. Storage operations call this function at
// their boundary so incomplete storage configuration still fails closed.
export function requireR2Environment(): R2Environment {
  return {
    accountId: requireEnvironmentVariable("R2_ACCOUNT_ID"),
    accessKeyId: requireEnvironmentVariable("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnvironmentVariable("R2_SECRET_ACCESS_KEY"),
    bucketName: requireEnvironmentVariable("R2_BUCKET_NAME"),
    endpoint: requireEnvironmentVariable("R2_ENDPOINT"),
  };
}
