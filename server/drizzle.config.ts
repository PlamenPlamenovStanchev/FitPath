import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "../drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migration generation is offline. Applying migrations requires DATABASE_URL.
    url: process.env.DATABASE_URL ?? "",
  },
});
