import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express from "express";
import { serverEnv } from "./config/env.js";
import { adminRouter } from "./routes/admin.js";
import { adminTrainerApplicationsRouter } from "./routes/admin-trainer-applications.js";
import { meRouter } from "./routes/me.js";
import { progressRouter } from "./routes/progress.js";
import { progressPhotosRouter } from "./routes/progress-photos.js";
import { trainersRouter } from "./routes/trainers.js";
import { trainingPlansRouter } from "./routes/training-plans.js";
import { trainerApplicationsRouter } from "./routes/trainer-applications.js";
import { workoutCompletionsRouter } from "./routes/workout-completions.js";

const app = express();

app.use(clerkMiddleware());
app.use(cors({ origin: serverEnv.clientOrigin }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", meRouter);
app.use("/api", adminRouter);
app.use("/api", trainerApplicationsRouter);
app.use("/api", adminTrainerApplicationsRouter);
app.use("/api", trainersRouter);
app.use("/api", trainingPlansRouter);
app.use("/api", progressRouter);
app.use("/api", progressPhotosRouter);
app.use("/api", workoutCompletionsRouter);

app.listen(serverEnv.port, () => {
  console.log(`FitPath API listening on http://localhost:${serverEnv.port}`);
});
