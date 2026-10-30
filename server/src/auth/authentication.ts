import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

declare module "express-serve-static-core" {
  interface Request {
    fitPathClerkUserId?: string;
  }
}

export function requireAuthenticatedUser(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const { isAuthenticated, userId } = getAuth(request);

  if (!isAuthenticated || !userId) {
    response.status(401).json({ error: "Unauthenticated" });
    return;
  }

  request.fitPathClerkUserId = userId;
  next();
}

export function getAuthenticatedClerkUserId(request: Request): string {
  if (!request.fitPathClerkUserId) {
    throw new Error("Authenticated Clerk user ID is unavailable");
  }

  return request.fitPathClerkUserId;
}
