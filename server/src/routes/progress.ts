import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import { profiles, progressEntries, trainerAssignments, users } from "../db/schema.js";

const progressRouter = Router();

const progressFields = {
  id: progressEntries.id,
  weightKg: progressEntries.weightKg,
  bmi: progressEntries.bmi,
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

function serializeProgress(entry: {
  id: string;
  weightKg: string;
  bmi: string;
  recordedAt: Date;
}) {
  return {
    id: entry.id,
    weightKg: Number(entry.weightKg),
    bmi: Number(entry.bmi),
    recordedAt: entry.recordedAt,
  };
}

function parseProgressInput(
  value: unknown,
): { value: { weightKg: number; recordedAt: Date } } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "A valid progress payload is required." };
  }

  const { weightKg, recordedAt } = value as Record<string, unknown>;

  if (
    typeof weightKg !== "number" ||
    !Number.isFinite(weightKg) ||
    weightKg < 20 ||
    weightKg > 500
  ) {
    return { error: "Weight must be a number between 20 and 500 kilograms." };
  }

  if (recordedAt === undefined || recordedAt === null) {
    return { value: { weightKg, recordedAt: new Date() } };
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

  return { value: { weightKg, recordedAt: parsedDate } };
}

async function getLocalUser(clerkUserId: string): Promise<LocalUser | null> {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user ?? null;
}

async function getProgressForUser(userId: string) {
  const entries = await db
    .select(progressFields)
    .from(progressEntries)
    .where(eq(progressEntries.userId, userId))
    .orderBy(desc(progressEntries.recordedAt));

  return entries.map(serializeProgress);
}

progressRouter.get("/me/progress", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = await getLocalUser(getAuthenticatedClerkUserId(request));

    if (!user) {
      response.status(403).json({ error: "Forbidden" });
      return;
    }

    response.status(200).json({ entries: await getProgressForUser(user.id) });
  } catch {
    console.error("Failed to load progress entries");
    response.status(500).json({ error: "Internal server error" });
  }
});

progressRouter.post("/me/progress", requireAuthenticatedUser, async (request, response) => {
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

    const [profile] = await db
      .select({ heightCm: profiles.heightCm })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    const heightCm = profile?.heightCm === null ? null : Number(profile?.heightCm);

    if (!heightCm || !Number.isFinite(heightCm) || heightCm < 50 || heightCm > 300) {
      response.status(404).json({ error: "A profile with a valid height is required." });
      return;
    }

    const bmi = calculateBmi(parsedInput.value.weightKg, heightCm);
    const [entry] = await db
      .insert(progressEntries)
      .values({
        userId: user.id,
        weightKg: parsedInput.value.weightKg.toFixed(2),
        bmi: bmi.toFixed(1),
        recordedAt: parsedInput.value.recordedAt,
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
});

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

      response.status(200).json({ entries: await getProgressForUser(client.id) });
    } catch {
      console.error("Failed to load client progress entries");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

export { progressRouter };
