import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), "../.env"), quiet: true });

const app = express();
const port = Number(process.env.PORT ?? 3000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`FitPath API listening on http://localhost:${port}`);
});
