import { and, asc, eq, sql } from "drizzle-orm";
import { Router } from "express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import { trainerApplications, users } from "../db/schema.js";
import { getObject } from "../storage/r2.js";

const adminTrainerApplicationsRouter = Router();

const pendingApplicationFields = {
  id: trainerApplications.id,
  applicantId: users.clerkUserId,
  specialization: trainerApplications.specialization,
  biography: trainerApplications.biography,
  submittedAt: trainerApplications.submittedAt,
};

async function getCurrentAdminId(clerkUserId: string): Promise<string | null> {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return admin?.id ?? null;
}

function requireApplicationId(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

adminTrainerApplicationsRouter.get(
  "/admin/trainer-applications",
  requireAuthenticatedUser,
  requireFitPathRole("ADMIN"),
  async (_request, response) => {
    try {
      const applications = await db
        .select(pendingApplicationFields)
        .from(trainerApplications)
        .innerJoin(users, eq(users.id, trainerApplications.userId))
        .where(eq(trainerApplications.status, "PENDING"))
        .orderBy(asc(trainerApplications.submittedAt));

      response.status(200).json({ applications });
    } catch {
      console.error("Failed to load pending trainer applications");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

adminTrainerApplicationsRouter.get(
  "/admin/trainer-applications/:id/certificate",
  requireAuthenticatedUser,
  requireFitPathRole("ADMIN"),
  async (request, response) => {
    const applicationId = requireApplicationId(request.params.id);

    if (!applicationId) {
      response.status(400).json({ error: "Invalid trainer application ID." });
      return;
    }

    try {
      const [application] = await db
        .select({ certificateObjectKey: trainerApplications.certificateObjectKey })
        .from(trainerApplications)
        .where(eq(trainerApplications.id, applicationId))
        .limit(1);

      if (!application) {
        response.status(404).json({ error: "Trainer application was not found." });
        return;
      }

      const certificate = await getObject(application.certificateObjectKey);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="trainer-certificate-${applicationId}.pdf"`,
      );
      response.setHeader("Content-Length", certificate.length.toString());
      response.status(200).send(certificate);
    } catch {
      console.error("Failed to retrieve trainer certificate");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

adminTrainerApplicationsRouter.patch(
  "/admin/trainer-applications/:id/approve",
  requireAuthenticatedUser,
  requireFitPathRole("ADMIN"),
  async (request, response) => {
    const applicationId = requireApplicationId(request.params.id);

    if (!applicationId) {
      response.status(400).json({ error: "Invalid trainer application ID." });
      return;
    }

    try {
      const adminId = await getCurrentAdminId(getAuthenticatedClerkUserId(request));

      if (!adminId) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      // A single PostgreSQL statement is atomic: either every CTE succeeds or none do.
      const result = await db.execute<{ id: string }>(sql`
        WITH pending_application AS (
          SELECT id, user_id, specialization, biography
          FROM trainer_applications
          WHERE id = ${applicationId}::uuid
            AND status = 'PENDING'
          FOR UPDATE
        ), created_trainer_profile AS (
          INSERT INTO trainer_profiles (
            user_id,
            specialization,
            biography,
            approved_at,
            created_at,
            updated_at
          )
          SELECT user_id, specialization, biography, now(), now(), now()
          FROM pending_application
          ON CONFLICT (user_id) DO NOTHING
          RETURNING user_id
        ), updated_user AS (
          UPDATE users
          SET role = 'TRAINER', updated_at = now()
          WHERE id IN (SELECT user_id FROM created_trainer_profile)
            AND role = 'USER'
          RETURNING id
        )
        UPDATE trainer_applications
        SET status = 'APPROVED', reviewed_at = now(), reviewed_by = ${adminId}::uuid
        WHERE id IN (SELECT id FROM pending_application)
          AND user_id IN (SELECT id FROM updated_user)
        RETURNING id
      `);

      if (result.rows.length === 0) {
        response.status(409).json({ error: "Application is no longer pending." });
        return;
      }

      response.status(200).json({ status: "APPROVED" });
    } catch {
      console.error("Failed to approve trainer application");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

adminTrainerApplicationsRouter.patch(
  "/admin/trainer-applications/:id/reject",
  requireAuthenticatedUser,
  requireFitPathRole("ADMIN"),
  async (request, response) => {
    const applicationId = requireApplicationId(request.params.id);

    if (!applicationId) {
      response.status(400).json({ error: "Invalid trainer application ID." });
      return;
    }

    try {
      const adminId = await getCurrentAdminId(getAuthenticatedClerkUserId(request));

      if (!adminId) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const [application] = await db
        .update(trainerApplications)
        .set({
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedBy: adminId,
        })
        .where(
          and(
            eq(trainerApplications.id, applicationId),
            eq(trainerApplications.status, "PENDING"),
          ),
        )
        .returning({ id: trainerApplications.id });

      if (!application) {
        response.status(409).json({ error: "Application is no longer pending." });
        return;
      }

      response.status(200).json({ status: "REJECTED" });
    } catch {
      console.error("Failed to reject trainer application");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

export { adminTrainerApplicationsRouter };
