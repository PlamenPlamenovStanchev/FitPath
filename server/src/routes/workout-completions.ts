import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import {
  trainerAssignments,
  trainingPlans,
  users,
  workoutCompletions,
  workoutDays,
} from "../db/schema.js";

const workoutCompletionsRouter = Router();

type LocalUser = { id: string; role: "USER" | "TRAINER" | "ADMIN" };

const completionFields = {
  id: workoutCompletions.id,
  workoutDayId: workoutCompletions.workoutDayId,
  completedAt: workoutCompletions.completedAt,
};

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function getLocalUser(clerkUserId: string): Promise<LocalUser | null> {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user ?? null;
}

async function getWorkoutDayPlan(workoutDayId: string) {
  const [workoutDay] = await db
    .select({ workoutDayId: workoutDays.id, clientUserId: trainingPlans.clientUserId })
    .from(workoutDays)
    .innerJoin(trainingPlans, eq(trainingPlans.id, workoutDays.trainingPlanId))
    .where(eq(workoutDays.id, workoutDayId))
    .limit(1);

  return workoutDay ?? null;
}

async function getCompletionsForUser(userId: string) {
  return db
    .select(completionFields)
    .from(workoutCompletions)
    .where(eq(workoutCompletions.userId, userId))
    .orderBy(desc(workoutCompletions.completedAt));
}

workoutCompletionsRouter.post(
  "/workout-days/:id/complete",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    if (!isUuid(request.params.id)) {
      response.status(404).json({ error: "Workout day was not found." });
      return;
    }

    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));

      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const workoutDay = await getWorkoutDayPlan(request.params.id);

      if (!workoutDay) {
        response.status(404).json({ error: "Workout day was not found." });
        return;
      }

      if (workoutDay.clientUserId !== user.id) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const [completion] = await db
        .insert(workoutCompletions)
        .values({ userId: user.id, workoutDayId: workoutDay.workoutDayId, completedAt: new Date() })
        .returning(completionFields);

      if (!completion) {
        throw new Error("Workout completion insert did not return a result");
      }

      response.status(201).json({ completion });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ error: "This workout day is already completed." });
        return;
      }

      console.error("Failed to complete workout day");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

workoutCompletionsRouter.delete(
  "/workout-days/:id/complete",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    if (!isUuid(request.params.id)) {
      response.status(404).json({ error: "Workout day was not found." });
      return;
    }

    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));

      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const workoutDay = await getWorkoutDayPlan(request.params.id);

      if (!workoutDay) {
        response.status(404).json({ error: "Workout day was not found." });
        return;
      }

      if (workoutDay.clientUserId !== user.id) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const [completion] = await db
        .delete(workoutCompletions)
        .where(
          and(
            eq(workoutCompletions.userId, user.id),
            eq(workoutCompletions.workoutDayId, workoutDay.workoutDayId),
          ),
        )
        .returning({ workoutDayId: workoutCompletions.workoutDayId });

      if (!completion) {
        response.status(404).json({ error: "Workout completion was not found." });
        return;
      }

      response.status(200).json(completion);
    } catch {
      console.error("Failed to undo workout completion");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

workoutCompletionsRouter.get(
  "/me/workout-completions",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));

      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      response.status(200).json({ completions: await getCompletionsForUser(user.id) });
    } catch {
      console.error("Failed to load workout completions");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

workoutCompletionsRouter.get(
  "/trainer/clients/:clientId/workout-completions",
  requireAuthenticatedUser,
  requireFitPathRole("TRAINER", "ADMIN"),
  async (request, response) => {
    if (!isUuid(request.params.clientId)) {
      response.status(404).json({ error: "Client was not found." });
      return;
    }

    try {
      const actor = await getLocalUser(getAuthenticatedClerkUserId(request));

      if (!actor) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const [client] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, request.params.clientId))
        .limit(1);

      if (!client) {
        response.status(404).json({ error: "Client was not found." });
        return;
      }

      if (actor.role === "TRAINER") {
        const [assignment] = await db
          .select({ id: trainerAssignments.id })
          .from(trainerAssignments)
          .where(
            and(
              eq(trainerAssignments.trainerUserId, actor.id),
              eq(trainerAssignments.clientUserId, client.id),
              eq(trainerAssignments.active, true),
            ),
          )
          .limit(1);

        if (!assignment) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
      }

      response.status(200).json({ completions: await getCompletionsForUser(client.id) });
    } catch {
      console.error("Failed to load client workout completions");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

export { workoutCompletionsRouter };
