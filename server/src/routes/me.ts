import { eq } from "drizzle-orm";
import { Router } from "express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

const meRouter = Router();

const userResponseFields = {
  id: users.id,
  role: users.role,
  onboardingCompleted: users.onboardingCompleted,
};

meRouter.get("/me", requireAuthenticatedUser, async (request, response) => {
  const clerkUserId = getAuthenticatedClerkUserId(request);

  try {
    await db
      .insert(users)
      .values({ clerkUserId })
      .onConflictDoNothing({ target: users.clerkUserId });

    const [user] = await db
      .select(userResponseFields)
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!user) {
      throw new Error("FitPath user was not available after synchronization");
    }

    response.status(200).json(user);
  } catch {
    console.error("Failed to synchronize FitPath user");
    response.status(500).json({ error: "Internal server error" });
  }
});

export { meRouter };
