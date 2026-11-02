import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { getAuthenticatedClerkUserId } from "./authentication.js";

export const fitPathRoles = ["USER", "TRAINER", "ADMIN"] as const;
export type FitPathRole = (typeof fitPathRoles)[number];

export function requireFitPathRole(...allowedRoles: FitPathRole[]) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    let clerkUserId: string;

    try {
      clerkUserId = getAuthenticatedClerkUserId(request);
    } catch {
      response.status(401).json({ error: "Unauthenticated" });
      return;
    }

    try {
      // A user can open a protected deep link before /api/me has completed its
      // lazy synchronization. Ensure an authenticated Clerk account has its
      // default local USER record before checking its FitPath role.
      await db
        .insert(users)
        .values({ clerkUserId })
        .onConflictDoNothing({ target: users.clerkUserId });

      const [user] = await db
        .select({ role: users.role, active: users.active })
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1);

      if (!user) {
        response
          .status(403)
          .json({ error: "Your FitPath account could not be found." });
        return;
      }

      if (!user.active) {
        response
          .status(403)
          .json({ error: "This FitPath account has been deactivated." });
        return;
      }

      if (!allowedRoles.includes(user.role)) {
        response.status(403).json({
          error: `This action requires the ${allowedRoles.join(" or ")} role. Your account is currently ${user.role}.`,
        });
        return;
      }

      next();
    } catch {
      console.error("Failed to authorize FitPath role");
      response.status(500).json({ error: "Internal server error" });
    }
  };
}
