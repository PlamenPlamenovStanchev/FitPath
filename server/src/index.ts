import cors from "cors";
import express from "express";
import { serverEnv } from "./config/env.js";

const app = express();

app.use(cors({ origin: serverEnv.clientOrigin }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.listen(serverEnv.port, () => {
  console.log(`FitPath API listening on http://localhost:${serverEnv.port}`);
});
