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
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1);

      if (!user || !allowedRoles.includes(user.role)) {
        response.status(403).json({ error: "Forbidden" });
        return;
      }

      next();
    } catch {
      console.error("Failed to authorize FitPath role");
      response.status(500).json({ error: "Internal server error" });
    }
  };
}
