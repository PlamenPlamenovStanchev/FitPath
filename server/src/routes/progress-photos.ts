import { and, desc, eq } from "drizzle-orm";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import { progressPhotos, trainerAssignments, users } from "../db/schema.js";
import { createUploadObjectKey, maximumUploadSizeBytes } from "../storage/object-keys.js";
import { deleteObject, getObject, uploadObject } from "../storage/r2.js";

const progressPhotosRouter = Router();
const progressPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumUploadSizeBytes, files: 1, fields: 0 },
});

type LocalUser = { id: string; role: "USER" | "TRAINER" | "ADMIN" };

const progressPhotoFields = {
  id: progressPhotos.id,
  createdAt: progressPhotos.createdAt,
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function imageContentType(objectKey: string): "image/jpeg" | "image/png" | "image/webp" {
  if (objectKey.endsWith(".png")) return "image/png";
  if (objectKey.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function isValidProgressPhoto(file: Express.Multer.File): boolean {
  const jpegSignature = file.buffer.length >= 3 && file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const pngSignature = file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webpSignature = file.buffer.length >= 12 && file.buffer.subarray(0, 4).equals(Buffer.from("RIFF")) && file.buffer.subarray(8, 12).equals(Buffer.from("WEBP"));

  return (
    (file.mimetype === "image/jpeg" && jpegSignature) ||
    (file.mimetype === "image/png" && pngSignature) ||
    (file.mimetype === "image/webp" && webpSignature)
  );
}

function parseProgressPhoto(request: Request, response: Response, next: NextFunction): void {
  progressPhotoUpload.single("photo")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({
        error: error.code === "LIMIT_FILE_SIZE"
          ? "Progress photos must be 5 MB or smaller."
          : "A valid progress photo upload is required.",
      });
      return;
    }

    if (error) {
      response.status(400).json({ error: "A valid progress photo upload is required." });
      return;
    }

    next();
  });
}

async function getLocalUser(clerkUserId: string): Promise<LocalUser | null> {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user ?? null;
}

async function hasActiveTrainerAssignment(trainerUserId: string, clientUserId: string): Promise<boolean> {
  const [assignment] = await db
    .select({ id: trainerAssignments.id })
    .from(trainerAssignments)
    .where(and(
      eq(trainerAssignments.trainerUserId, trainerUserId),
      eq(trainerAssignments.clientUserId, clientUserId),
      eq(trainerAssignments.active, true),
    ))
    .limit(1);

  return Boolean(assignment);
}

async function sendProgressPhoto(response: Response, objectKey: string): Promise<void> {
  const photo = await getObject(objectKey);
  response.setHeader("Content-Type", imageContentType(objectKey));
  response.setHeader("Content-Length", photo.length.toString());
  response.setHeader("Cache-Control", "private, no-store");
  response.status(200).send(photo);
}

progressPhotosRouter.post(
  "/me/progress-photos",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  parseProgressPhoto,
  async (request, response) => {
    const photo = request.file;

    if (!photo || !isValidProgressPhoto(photo)) {
      response.status(400).json({ error: "Progress photo must be a valid JPEG, PNG, or WebP image." });
      return;
    }

    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));

      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const objectKey = createUploadObjectKey("progress-photos", photo.mimetype, photo.size);
      await uploadObject({ key: objectKey, body: photo.buffer, contentType: photo.mimetype });

      try {
        const [progressPhoto] = await db
          .insert(progressPhotos)
          .values({ userId: user.id, objectKey })
          .returning(progressPhotoFields);

        if (!progressPhoto) throw new Error("Progress photo insert did not return a result");
        response.status(201).json({ photo: progressPhoto });
      } catch (error) {
        try {
          await deleteObject(objectKey);
        } catch {
          console.error("Failed to clean up progress photo upload");
        }
        throw error;
      }
    } catch {
      console.error("Failed to upload progress photo");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

progressPhotosRouter.get(
  "/me/progress-photos",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));
      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const photos = await db.select(progressPhotoFields).from(progressPhotos)
        .where(eq(progressPhotos.userId, user.id)).orderBy(desc(progressPhotos.createdAt));
      response.status(200).json({ photos });
    } catch {
      console.error("Failed to list progress photos");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

progressPhotosRouter.get(
  "/me/progress-photos/:id",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    if (!isUuid(request.params.id)) {
      response.status(404).json({ error: "Progress photo was not found." });
      return;
    }

    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));
      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }
      const [photo] = await db.select({ objectKey: progressPhotos.objectKey }).from(progressPhotos)
        .where(and(eq(progressPhotos.id, request.params.id), eq(progressPhotos.userId, user.id))).limit(1);
      if (!photo) {
        response.status(404).json({ error: "Progress photo was not found." });
        return;
      }
      await sendProgressPhoto(response, photo.objectKey);
    } catch {
      console.error("Failed to retrieve progress photo");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

progressPhotosRouter.delete(
  "/me/progress-photos/:id",
  requireAuthenticatedUser,
  requireFitPathRole("USER"),
  async (request, response) => {
    if (!isUuid(request.params.id)) {
      response.status(404).json({ error: "Progress photo was not found." });
      return;
    }

    try {
      const user = await getLocalUser(getAuthenticatedClerkUserId(request));
      if (!user) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      const [deletedPhoto] = await db.delete(progressPhotos).where(and(
        eq(progressPhotos.id, request.params.id),
        eq(progressPhotos.userId, user.id),
      )).returning({
        id: progressPhotos.id,
        userId: progressPhotos.userId,
        objectKey: progressPhotos.objectKey,
        createdAt: progressPhotos.createdAt,
      });

      if (!deletedPhoto) {
        response.status(404).json({ error: "Progress photo was not found." });
        return;
      }

      try {
        await deleteObject(deletedPhoto.objectKey);
      } catch (storageError) {
        try {
          await db.insert(progressPhotos).values(deletedPhoto);
        } catch {
          console.error("Failed to restore progress photo record after storage deletion failure");
        }
        throw storageError;
      }

      response.status(200).json({ id: deletedPhoto.id });
    } catch {
      console.error("Failed to delete progress photo");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

progressPhotosRouter.get(
  "/trainer/clients/:clientId/progress-photos",
  requireAuthenticatedUser,
  requireFitPathRole("TRAINER"),
  async (request, response) => {
    if (!isUuid(request.params.clientId)) {
      response.status(404).json({ error: "Client was not found." });
      return;
    }
    try {
      const trainer = await getLocalUser(getAuthenticatedClerkUserId(request));
      if (!trainer || !await hasActiveTrainerAssignment(trainer.id, request.params.clientId)) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }
      const photos = await db.select(progressPhotoFields).from(progressPhotos)
        .where(eq(progressPhotos.userId, request.params.clientId)).orderBy(desc(progressPhotos.createdAt));
      response.status(200).json({ photos });
    } catch {
      console.error("Failed to list client progress photos");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

progressPhotosRouter.get(
  "/trainer/clients/:clientId/progress-photos/:id",
  requireAuthenticatedUser,
  requireFitPathRole("TRAINER"),
  async (request, response) => {
    if (!isUuid(request.params.clientId) || !isUuid(request.params.id)) {
      response.status(404).json({ error: "Progress photo was not found." });
      return;
    }
    try {
      const trainer = await getLocalUser(getAuthenticatedClerkUserId(request));
      if (!trainer || !await hasActiveTrainerAssignment(trainer.id, request.params.clientId)) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }
      const [photo] = await db.select({ objectKey: progressPhotos.objectKey }).from(progressPhotos)
        .where(and(eq(progressPhotos.id, request.params.id), eq(progressPhotos.userId, request.params.clientId))).limit(1);
      if (!photo) {
        response.status(404).json({ error: "Progress photo was not found." });
        return;
      }
      await sendProgressPhoto(response, photo.objectKey);
    } catch {
      console.error("Failed to retrieve client progress photo");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

export { progressPhotosRouter };
