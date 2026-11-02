import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
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
// API responses contain account-specific authorization state. Prevent a
// browser cache from serving an earlier role or application status.
app.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", meRouter);
app.use("/api", trainerApplicationsRouter);
app.use("/api", adminTrainerApplicationsRouter);
app.use("/api", trainersRouter);
app.use("/api", trainingPlansRouter);
app.use("/api", progressRouter);
app.use("/api", progressPhotosRouter);
app.use("/api", workoutCompletionsRouter);
// adminRouter applies ADMIN authorization at router level, so it must be
// mounted after the non-admin routers rather than intercepting every /api
// request that follows it.
app.use("/api", adminRouter);

// Keep parser and unexpected route failures from falling through to Express's
// development error page, which can include implementation details.
app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Invalid JSON request body." });
      return;
    }

    console.error("Unhandled API error");
    response.status(500).json({ error: "Internal server error" });
  },
);

app.listen(serverEnv.port, () => {
  console.log(`FitPath API listening on http://localhost:${serverEnv.port}`);
});
