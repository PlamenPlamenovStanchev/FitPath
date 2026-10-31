import { and, desc, eq } from "drizzle-orm";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import { trainerApplications, users } from "../db/schema.js";
import { createUploadObjectKey, maximumUploadSizeBytes } from "../storage/object-keys.js";
import { deleteObject, uploadObject } from "../storage/r2.js";

const trainerApplicationsRouter = Router();
const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maximumUploadSizeBytes,
    files: 1,
    fields: 2,
    fieldSize: 1_000,
  },
});

const applicationResponseFields = {
  id: trainerApplications.id,
  status: trainerApplications.status,
  submittedAt: trainerApplications.submittedAt,
};

function parseCertificate(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  certificateUpload.single("certificate")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "Certificate must be 5 MB or smaller."
            : "A valid certificate upload is required.",
      });
      return;
    }

    if (error) {
      response.status(400).json({ error: "A valid certificate upload is required." });
      return;
    }

    next();
  });
}

function validateApplicationFields(value: unknown):
  | { value: { specialization: string; biography: string } }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "A valid trainer application is required." };
  }

  const { specialization, biography } = value as Record<string, unknown>;

  if (
    typeof specialization !== "string" ||
    specialization.trim().length === 0 ||
    specialization.trim().length > 120
  ) {
    return { error: "Specialization is required and must be 120 characters or fewer." };
  }

  if (
    typeof biography !== "string" ||
    biography.trim().length === 0 ||
    biography.trim().length > 1_000
  ) {
    return { error: "Biography is required and must be 1,000 characters or fewer." };
  }

  return {
    value: {
      specialization: specialization.trim(),
      biography: biography.trim(),
    },
  };
}

function isPdfCertificate(file: Express.Multer.File): boolean {
  return (
    file.mimetype === "application/pdf" &&
    file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("code" in error && error.code === "23505") {
    return true;
  }

  return "cause" in error && isUniqueViolation(error.cause);
}

trainerApplicationsRouter.get(
  "/trainer-applications/me",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    const clerkUserId = getAuthenticatedClerkUserId(request);

    try {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1);

      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const [application] = await db
        .select(applicationResponseFields)
        .from(trainerApplications)
        .where(eq(trainerApplications.userId, user.id))
        .orderBy(desc(trainerApplications.submittedAt))
        .limit(1);

      response.status(200).json({ application: application ?? null });
    } catch {
      console.error("Failed to load trainer application");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

trainerApplicationsRouter.post(
  "/trainer-applications",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  parseCertificate,
  async (request, response) => {
    const validation = validateApplicationFields(request.body);

    if ("error" in validation) {
      response.status(400).json({ error: validation.error });
      return;
    }

    const certificate = request.file;

    if (!certificate || !isPdfCertificate(certificate)) {
      response.status(400).json({ error: "Certificate must be a valid PDF file." });
      return;
    }

    const clerkUserId = getAuthenticatedClerkUserId(request);

    try {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1);

      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const [pendingApplication] = await db
        .select({ id: trainerApplications.id })
        .from(trainerApplications)
        .where(
          and(
            eq(trainerApplications.userId, user.id),
            eq(trainerApplications.status, "PENDING"),
          ),
        )
        .limit(1);

      if (pendingApplication) {
        response.status(409).json({ error: "You already have a pending trainer application." });
        return;
      }

      const certificateObjectKey = createUploadObjectKey(
        "trainer-certificates",
        certificate.mimetype,
        certificate.size,
      );

      await uploadObject({
        key: certificateObjectKey,
        body: certificate.buffer,
        contentType: certificate.mimetype,
      });

      try {
        const [application] = await db
          .insert(trainerApplications)
          .values({
            userId: user.id,
            specialization: validation.value.specialization,
            biography: validation.value.biography,
            certificateObjectKey,
          })
          .returning(applicationResponseFields);

        if (!application) {
          throw new Error("Trainer application insert did not return a result");
        }

        response.status(201).json({ application });
      } catch (error) {
        try {
          await deleteObject(certificateObjectKey);
        } catch {
          console.error("Failed to clean up trainer certificate upload");
        }

        if (isUniqueViolation(error)) {
          response.status(409).json({ error: "You already have a pending trainer application." });
          return;
        }

        throw error;
      }
    } catch {
      console.error("Failed to create trainer application");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

export { trainerApplicationsRouter };
