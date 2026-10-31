import { and, asc, eq, sql } from "drizzle-orm";
import { Router } from "express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import { trainerAssignments, trainerProfiles, users } from "../db/schema.js";
import { getObject } from "../storage/r2.js";

const trainersRouter = Router();

const trainerFields = {
  userId: trainerProfiles.userId,
  specialization: trainerProfiles.specialization,
  biography: trainerProfiles.biography,
  profilePhotoAvailable: sql<boolean>`${trainerProfiles.profilePhotoObjectKey} IS NOT NULL`,
  profilePhotoAccessPath: sql<string | null>`CASE
    WHEN ${trainerProfiles.profilePhotoObjectKey} IS NOT NULL
    THEN '/api/trainers/' || ${trainerProfiles.userId}::text || '/profile-photo'
    ELSE NULL
  END`,
};

function requireUserId(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

function profilePhotoContentType(objectKey: string): string {
  if (objectKey.endsWith(".png")) {
    return "image/png";
  }

  if (objectKey.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

async function getLocalUserId(clerkUserId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user?.id ?? null;
}

trainersRouter.get("/trainers", requireAuthenticatedUser, async (_request, response) => {
  try {
    const trainers = await db
      .select(trainerFields)
      .from(trainerProfiles)
      .innerJoin(users, eq(users.id, trainerProfiles.userId))
      .where(eq(users.role, "TRAINER"))
      .orderBy(asc(trainerProfiles.specialization));

    response.status(200).json({ trainers });
  } catch {
    console.error("Failed to load trainers");
    response.status(500).json({ error: "Internal server error" });
  }
});

trainersRouter.get(
  "/trainers/:id/profile-photo",
  requireAuthenticatedUser,
  async (request, response) => {
    const trainerUserId = requireUserId(request.params.id);

    if (!trainerUserId) {
      response.status(400).json({ error: "Invalid trainer user ID." });
      return;
    }

    try {
      const [trainer] = await db
        .select({ profilePhotoObjectKey: trainerProfiles.profilePhotoObjectKey })
        .from(trainerProfiles)
        .innerJoin(users, eq(users.id, trainerProfiles.userId))
        .where(
          and(eq(trainerProfiles.userId, trainerUserId), eq(users.role, "TRAINER")),
        )
        .limit(1);

      if (!trainer?.profilePhotoObjectKey) {
        response.status(404).json({ error: "Trainer profile photo was not found." });
        return;
      }

      const profilePhoto = await getObject(trainer.profilePhotoObjectKey);

      response.setHeader("Content-Type", profilePhotoContentType(trainer.profilePhotoObjectKey));
      response.setHeader("Content-Length", profilePhoto.length.toString());
      response.status(200).send(profilePhoto);
    } catch {
      console.error("Failed to retrieve trainer profile photo");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

trainersRouter.get(
  "/me/trainer",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    try {
      const clientUserId = await getLocalUserId(getAuthenticatedClerkUserId(request));

      if (!clientUserId) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const [trainer] = await db
        .select(trainerFields)
        .from(trainerAssignments)
        .innerJoin(users, eq(users.id, trainerAssignments.trainerUserId))
        .innerJoin(trainerProfiles, eq(trainerProfiles.userId, users.id))
        .where(
          and(
            eq(trainerAssignments.clientUserId, clientUserId),
            eq(trainerAssignments.active, true),
            eq(users.role, "TRAINER"),
          ),
        )
        .limit(1);

      response.status(200).json({ trainer: trainer ?? null });
    } catch {
      console.error("Failed to load assigned trainer");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

trainersRouter.post(
  "/me/trainer",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    const trainerUserId = requireUserId(
      request.body && typeof request.body === "object"
        ? (request.body as Record<string, unknown>).trainerUserId
        : undefined,
    );

    if (!trainerUserId) {
      response.status(400).json({ error: "A valid trainer user ID is required." });
      return;
    }

    try {
      const clientUserId = await getLocalUserId(getAuthenticatedClerkUserId(request));

      if (!clientUserId) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      if (trainerUserId === clientUserId) {
        response.status(400).json({ error: "You cannot assign yourself as trainer." });
        return;
      }

      // This one statement atomically validates the trainer, closes any prior
      // active assignment, and creates the replacement assignment.
      const result = await db.execute<{ trainer_user_id: string }>(sql`
        WITH selected_trainer AS (
          SELECT id
          FROM users
          WHERE id = ${trainerUserId}::uuid
            AND role = 'TRAINER'
        ), deactivated_assignments AS (
          UPDATE trainer_assignments
          SET active = false, ended_at = now()
          WHERE client_user_id = ${clientUserId}::uuid
            AND active = true
            AND trainer_user_id <> ${trainerUserId}::uuid
            AND EXISTS (SELECT 1 FROM selected_trainer)
          RETURNING id
        ), inserted_assignment AS (
          INSERT INTO trainer_assignments (
            trainer_user_id,
            client_user_id,
            active,
            created_at
          )
          SELECT id, ${clientUserId}::uuid, true, now()
          FROM selected_trainer
          WHERE NOT EXISTS (
            SELECT 1
            FROM trainer_assignments
            WHERE client_user_id = ${clientUserId}::uuid
              AND trainer_user_id = ${trainerUserId}::uuid
              AND active = true
          )
            AND (SELECT count(*) FROM deactivated_assignments) >= 0
          ON CONFLICT (client_user_id) WHERE active = true DO NOTHING
          RETURNING trainer_user_id
        )
        SELECT trainer_user_id
        FROM inserted_assignment
      `);

      if (result.rows.length === 0) {
        const [existingAssignment] = await db
          .select({ trainerUserId: trainerAssignments.trainerUserId })
          .from(trainerAssignments)
          .where(
            and(
              eq(trainerAssignments.clientUserId, clientUserId),
              eq(trainerAssignments.active, true),
              eq(trainerAssignments.trainerUserId, trainerUserId),
            ),
          )
          .limit(1);

        if (existingAssignment) {
          response.status(200).json({ trainerUserId: existingAssignment.trainerUserId });
          return;
        }

        response.status(409).json({ error: "Trainer selection could not be completed." });
        return;
      }

      const [assignment] = result.rows;

      if (!assignment) {
        throw new Error("Trainer assignment did not return a result");
      }

      response.status(200).json({ trainerUserId: assignment.trainer_user_id });
    } catch {
      console.error("Failed to assign trainer");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

trainersRouter.get(
  "/trainer/clients",
  requireAuthenticatedUser,
  requireFitPathRole("TRAINER"),
  async (request, response) => {
    try {
      const trainerUserId = await getLocalUserId(getAuthenticatedClerkUserId(request));

      if (!trainerUserId) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const clients = await db
        .select({
          userId: users.id,
          clientId: users.clerkUserId,
        })
        .from(trainerAssignments)
        .innerJoin(users, eq(users.id, trainerAssignments.clientUserId))
        .where(
          and(
            eq(trainerAssignments.trainerUserId, trainerUserId),
            eq(trainerAssignments.active, true),
          ),
        )
        .orderBy(asc(trainerAssignments.createdAt));

      response.status(200).json({ clients });
    } catch {
      console.error("Failed to load trainer clients");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

export { trainersRouter };
