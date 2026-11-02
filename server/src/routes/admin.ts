import { asc, count, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { clerkClient } from "@clerk/express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { requireFitPathRole } from "../auth/authorization.js";
import { db } from "../db/client.js";
import {
  progressEntries,
  progressPhotos,
  trainerApplications,
  trainerAssignments,
  trainerProfiles,
  trainingPlans,
  users,
  workoutCompletions,
} from "../db/schema.js";
import { deleteObject } from "../storage/r2.js";

const adminRouter = Router();

adminRouter.use(requireAuthenticatedUser, requireFitPathRole("ADMIN"));

adminRouter.get("/admin/overview", async (_request, response) => {
  try {
    const [
      [totalUsers],
      [totalTrainers],
      [pendingTrainerApplications],
      [totalTrainingPlans],
    ] = await Promise.all([
      db.select({ value: count() }).from(users),
      db
        .select({ value: count() })
        .from(users)
        .where(eq(users.role, "TRAINER")),
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
        active: users.active,
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

async function getManageableUser(
  targetUserId: string,
  actorClerkUserId: string,
) {
  const [target] = await db
    .select({
      id: users.id,
      clerkUserId: users.clerkUserId,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) return { error: "User not found.", status: 404 } as const;
  if (target.clerkUserId === actorClerkUserId) {
    return {
      error: "You cannot manage your own account.",
      status: 400,
    } as const;
  }
  if (target.role === "ADMIN") {
    return {
      error: "Administrator accounts cannot be deactivated or deleted.",
      status: 403,
    } as const;
  }
  return { target } as const;
}

adminRouter.patch(
  "/admin/users/:userId/deactivate",
  async (request, response) => {
    try {
      const manageable = await getManageableUser(
        request.params.userId,
        getAuthenticatedClerkUserId(request),
      );
      if ("error" in manageable) {
        response
          .status(manageable.status ?? 400)
          .json({ error: manageable.error });
        return;
      }
      if (!manageable.target.active) {
        response
          .status(409)
          .json({ error: "This account is already deactivated." });
        return;
      }

      await clerkClient.users.banUser(manageable.target.clerkUserId);
      await db
        .update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(users.id, manageable.target.id));
      response.status(200).json({ id: manageable.target.id, active: false });
    } catch {
      console.error("Failed to deactivate user");
      response.status(500).json({
        error: "Unable to deactivate this account. Please try again.",
      });
    }
  },
);

adminRouter.delete("/admin/users/:userId", async (request, response) => {
  try {
    const manageable = await getManageableUser(
      request.params.userId,
      getAuthenticatedClerkUserId(request),
    );
    if ("error" in manageable) {
      response
        .status(manageable.status ?? 400)
        .json({ error: manageable.error });
      return;
    }

    const userId = manageable.target.id;
    const [photos, applications, profiles] = await Promise.all([
      db
        .select({ objectKey: progressPhotos.objectKey })
        .from(progressPhotos)
        .where(eq(progressPhotos.userId, userId)),
      db
        .select({ objectKey: trainerApplications.certificateObjectKey })
        .from(trainerApplications)
        .where(eq(trainerApplications.userId, userId)),
      db
        .select({ objectKey: trainerProfiles.profilePhotoObjectKey })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.userId, userId)),
    ]);

    await clerkClient.users.deleteUser(manageable.target.clerkUserId);
    await db.batch([
      db
        .delete(workoutCompletions)
        .where(eq(workoutCompletions.userId, userId)),
      db.delete(progressEntries).where(eq(progressEntries.userId, userId)),
      db.delete(progressPhotos).where(eq(progressPhotos.userId, userId)),
      db
        .delete(trainerAssignments)
        .where(inArray(trainerAssignments.trainerUserId, [userId])),
      db
        .delete(trainerAssignments)
        .where(inArray(trainerAssignments.clientUserId, [userId])),
      db
        .delete(trainerApplications)
        .where(eq(trainerApplications.userId, userId)),
      db
        .delete(trainingPlans)
        .where(inArray(trainingPlans.clientUserId, [userId])),
      db
        .delete(trainingPlans)
        .where(inArray(trainingPlans.createdByUserId, [userId])),
      db.delete(users).where(eq(users.id, userId)),
    ]);

    const objectKeys = [...photos, ...applications, ...profiles]
      .map(({ objectKey }) => objectKey)
      .filter((objectKey): objectKey is string => Boolean(objectKey));
    await Promise.allSettled(
      objectKeys.map((objectKey) => deleteObject(objectKey)),
    );
    response.status(204).send();
  } catch {
    console.error("Failed to delete user");
    response
      .status(500)
      .json({ error: "Unable to delete this account. Please try again." });
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
