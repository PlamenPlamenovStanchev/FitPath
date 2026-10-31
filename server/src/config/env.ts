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
  r2AccountId: requireEnvironmentVariable("R2_ACCOUNT_ID"),
  r2AccessKeyId: requireEnvironmentVariable("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: requireEnvironmentVariable("R2_SECRET_ACCESS_KEY"),
  r2BucketName: requireEnvironmentVariable("R2_BUCKET_NAME"),
  r2Endpoint: requireEnvironmentVariable("R2_ENDPOINT"),
};

export function requireDatabaseUrl(): string {
  if (!serverEnv.databaseUrl) {
    throw new Error("DATABASE_URL is required for database access");
  }

  return serverEnv.databaseUrl;
}
