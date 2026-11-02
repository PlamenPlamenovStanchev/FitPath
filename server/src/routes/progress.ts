import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { Router } from "express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import {
  profiles,
  progressEntries,
  trainerAssignments,
  trainingPlans,
  users,
} from "../db/schema.js";

const progressRouter = Router();

const progressFields = {
  id: progressEntries.id,
  weightKg: progressEntries.weightKg,
  bmi: progressEntries.bmi,
  trainingPlanId: progressEntries.trainingPlanId,
  recordedAt: progressEntries.recordedAt,
};

type LocalUser = { id: string; role: "USER" | "TRAINER" | "ADMIN" };

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function calculateBmi(weightKg: number, heightCm: number): number {
  const heightMeters = heightCm / 100;
  return Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10;
}

function dayBounds(value: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function serializeProgress(entry: {
  id: string;
  weightKg: string;
  bmi: string;
  trainingPlanId: string | null;
  recordedAt: Date;
}) {
  return {
    id: entry.id,
    weightKg: Number(entry.weightKg),
    bmi: Number(entry.bmi),
    trainingPlanId: entry.trainingPlanId,
    recordedAt: entry.recordedAt,
  };
}

function parseProgressInput(value: unknown):
  | {
      value: {
        weightKg: number;
        recordedAt: Date;
        trainingPlanId: string | null;
      };
    }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "A valid progress payload is required." };
  }

  const { weightKg, recordedAt, trainingPlanId } = value as Record<
    string,
    unknown
  >;

  if (
    typeof weightKg !== "number" ||
    !Number.isFinite(weightKg) ||
    weightKg < 20 ||
    weightKg > 500
  ) {
    return { error: "Weight must be a number between 20 and 500 kilograms." };
  }

  if (recordedAt === undefined || recordedAt === null) {
    if (
      trainingPlanId !== undefined &&
      trainingPlanId !== null &&
      !isUuid(trainingPlanId)
    ) {
      return { error: "Training plan ID is invalid." };
    }
    return {
      value: {
        weightKg,
        recordedAt: new Date(),
        trainingPlanId: trainingPlanId ?? null,
      },
    };
  }

  if (typeof recordedAt !== "string" || !recordedAt.trim()) {
    return { error: "Recorded at must be a valid timestamp." };
  }

  const parsedDate = new Date(recordedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return { error: "Recorded at must be a valid timestamp." };
  }

  if (parsedDate.getTime() > Date.now()) {
    return { error: "Recorded at cannot be in the future." };
  }

  if (
    trainingPlanId !== undefined &&
    trainingPlanId !== null &&
    !isUuid(trainingPlanId)
  ) {
    return { error: "Training plan ID is invalid." };
  }

  return {
    value: {
      weightKg,
      recordedAt: parsedDate,
      trainingPlanId: trainingPlanId ?? null,
    },
  };
}

async function getLocalUser(clerkUserId: string): Promise<LocalUser | null> {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user ?? null;
}

async function getProgressForUser(userId: string, trainingPlanId?: string) {
  const entries = await db
    .select(progressFields)
    .from(progressEntries)
    .where(
      and(
        eq(progressEntries.userId, userId),
        trainingPlanId
          ? eq(progressEntries.trainingPlanId, trainingPlanId)
          : undefined,
      ),
    )
    .orderBy(desc(progressEntries.recordedAt));

  return entries.map(serializeProgress);
}

async function hasPlanForUser(
  userId: string,
  planId: string,
): Promise<boolean> {
  const [plan] = await db
    .select({ id: trainingPlans.id })
    .from(trainingPlans)
    .where(
      and(eq(trainingPlans.id, planId), eq(trainingPlans.clientUserId, userId)),
    )
    .limit(1);
  return Boolean(plan);
}

progressRouter.get(
  "/me/progress",
  requireAuthenticatedUser,
  async (request, response) => {
    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));

      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const planId =
        typeof request.query.planId === "string"
          ? request.query.planId
          : undefined;
      if (
        planId &&
        (!isUuid(planId) || !(await hasPlanForUser(user.id, planId)))
      ) {
        response.status(404).json({ error: "Training plan was not found." });
        return;
      }
      response
        .status(200)
        .json({ entries: await getProgressForUser(user.id, planId) });
    } catch {
      console.error("Failed to load progress entries");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

progressRouter.post(
  "/me/progress",
  requireAuthenticatedUser,
  async (request, response) => {
    const parsedInput = parseProgressInput(request.body);

    if ("error" in parsedInput) {
      response.status(400).json({ error: parsedInput.error });
      return;
    }

    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));

      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      if (
        parsedInput.value.trainingPlanId &&
        !(await hasPlanForUser(user.id, parsedInput.value.trainingPlanId))
      ) {
        response.status(404).json({ error: "Training plan was not found." });
        return;
      }

      const [profile] = await db
        .select({ heightCm: profiles.heightCm })
        .from(profiles)
        .where(eq(profiles.userId, user.id))
        .limit(1);
      const heightCm =
        profile?.heightCm === null ? null : Number(profile?.heightCm);

      if (
        !heightCm ||
        !Number.isFinite(heightCm) ||
        heightCm < 50 ||
        heightCm > 300
      ) {
        response
          .status(404)
          .json({ error: "A profile with a valid height is required." });
        return;
      }

      const bmi = calculateBmi(parsedInput.value.weightKg, heightCm);
      const { start, end } = dayBounds(parsedInput.value.recordedAt);
      const [existingEntry] = await db
        .select({ id: progressEntries.id })
        .from(progressEntries)
        .where(
          and(
            eq(progressEntries.userId, user.id),
            parsedInput.value.trainingPlanId
              ? eq(
                  progressEntries.trainingPlanId,
                  parsedInput.value.trainingPlanId,
                )
              : isNull(progressEntries.trainingPlanId),
            gte(progressEntries.recordedAt, start),
            lt(progressEntries.recordedAt, end),
          ),
        )
        .orderBy(desc(progressEntries.recordedAt))
        .limit(1);

      if (existingEntry) {
        const [updatedEntry] = await db
          .update(progressEntries)
          .set({
            weightKg: parsedInput.value.weightKg.toFixed(2),
            bmi: bmi.toFixed(1),
            recordedAt: parsedInput.value.recordedAt,
            trainingPlanId: parsedInput.value.trainingPlanId,
          })
          .where(eq(progressEntries.id, existingEntry.id))
          .returning(progressFields);

        if (!updatedEntry) {
          throw new Error("Progress entry update did not return a result");
        }

        response.status(200).json({ entry: serializeProgress(updatedEntry) });
        return;
      }

      const [entry] = await db
        .insert(progressEntries)
        .values({
          userId: user.id,
          weightKg: parsedInput.value.weightKg.toFixed(2),
          bmi: bmi.toFixed(1),
          recordedAt: parsedInput.value.recordedAt,
          trainingPlanId: parsedInput.value.trainingPlanId,
        })
        .returning(progressFields);

      if (!entry) {
        throw new Error("Progress entry insert did not return a result");
      }

      response.status(201).json({ entry: serializeProgress(entry) });
    } catch {
      console.error("Failed to create progress entry");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

progressRouter.get(
  "/trainer/clients/:clientId/progress",
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

      const planId =
        typeof request.query.planId === "string"
          ? request.query.planId
          : undefined;
      if (
        planId &&
        (!isUuid(planId) || !(await hasPlanForUser(client.id, planId)))
      ) {
        response.status(404).json({ error: "Training plan was not found." });
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

      response
        .status(200)
        .json({ entries: await getProgressForUser(client.id, planId) });
    } catch {
      console.error("Failed to load client progress entries");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

export { progressRouter };
