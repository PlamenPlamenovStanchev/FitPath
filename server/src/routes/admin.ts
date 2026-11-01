import { asc, count, eq } from "drizzle-orm";
import { Router } from "express";

import { requireAuthenticatedUser } from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import { trainerApplications, trainingPlans, users } from "../db/schema.js";

const adminRouter = Router();

adminRouter.use(requireAuthenticatedUser, requireFitPathRole("ADMIN"));

adminRouter.get("/admin/overview", async (_request, response) => {
  try {
    const [[totalUsers], [totalTrainers], [pendingTrainerApplications], [totalTrainingPlans]] =
      await Promise.all([
        db.select({ value: count() }).from(users),
        db.select({ value: count() }).from(users).where(eq(users.role, "TRAINER")),
        db
          .select({ value: count() })
          .from(trainerApplications)
          .where(eq(trainerApplications.status, "PENDING")),
        db.select({ value: count() }).from(trainingPlans),
      ]);

    response.status(200).json({
      totalUsers: totalUsers?.value ?? 0,
      totalTrainers: totalTrainers?.value ?? 0,
      pendingTrainerApplications: pendingTrainerApplications?.value ?? 0,
      totalTrainingPlans: totalTrainingPlans?.value ?? 0,
    });
  } catch {
    console.error("Failed to load admin overview");
    response.status(500).json({ error: "Internal server error" });
  }
});

adminRouter.get("/admin/users", async (_request, response) => {
  try {
    const result = await db
      .select({
        id: users.id,
        role: users.role,
        onboardingCompleted: users.onboardingCompleted,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt));

    response.status(200).json({ users: result });
  } catch {
    console.error("Failed to load admin users");
    response.status(500).json({ error: "Internal server error" });
  }
});

adminRouter.get("/admin/training-plans", async (_request, response) => {
  try {
    const plans = await db
      .select({
        id: trainingPlans.id,
        title: trainingPlans.title,
        clientUserId: trainingPlans.clientUserId,
        createdByUserId: trainingPlans.createdByUserId,
        status: trainingPlans.status,
        startDate: trainingPlans.startDate,
        endDate: trainingPlans.endDate,
      })
      .from(trainingPlans)
      .orderBy(asc(trainingPlans.startDate));

    response.status(200).json({ plans });
  } catch {
    console.error("Failed to load admin training plans");
    response.status(500).json({ error: "Internal server error" });
  }
});

export { adminRouter };
