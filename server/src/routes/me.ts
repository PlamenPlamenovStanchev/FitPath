import { eq } from "drizzle-orm";
import { Router } from "express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { db } from "../db/client.js";
import { profiles, users } from "../db/schema.js";

const meRouter = Router();

const userResponseFields = {
  id: users.id,
  role: users.role,
  onboardingCompleted: users.onboardingCompleted,
};

const profileResponseFields = {
  profileId: profiles.id,
  age: profiles.age,
  heightCm: profiles.heightCm,
  currentWeightKg: profiles.currentWeightKg,
  activityLevel: profiles.activityLevel,
  fitnessGoal: profiles.fitnessGoal,
};

const activityLevels = [
  "SEDENTARY",
  "LIGHTLY_ACTIVE",
  "MODERATELY_ACTIVE",
  "VERY_ACTIVE",
] as const;

const fitnessGoals = [
  "LOSE_WEIGHT",
  "BUILD_MUSCLE",
  "IMPROVE_FITNESS",
  "MAINTAIN_CONDITION",
] as const;

type ActivityLevel = (typeof activityLevels)[number];
type FitnessGoal = (typeof fitnessGoals)[number];

type OnboardingInput = {
  age: number;
  heightCm: number;
  currentWeightKg: number;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
};

function validateOnboardingInput(
  value: unknown,
): { value: OnboardingInput } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "A valid onboarding payload is required." };
  }

  const body = value as Record<string, unknown>;
  const { age, heightCm, currentWeightKg, activityLevel, fitnessGoal } = body;

  if (
    typeof age !== "number" ||
    !Number.isInteger(age) ||
    age < 13 ||
    age > 120
  ) {
    return { error: "Age must be an integer between 13 and 120." };
  }

  if (
    typeof heightCm !== "number" ||
    !Number.isFinite(heightCm) ||
    heightCm < 50 ||
    heightCm > 300
  ) {
    return { error: "Height must be a number between 50 and 300 centimeters." };
  }

  if (
    typeof currentWeightKg !== "number" ||
    !Number.isFinite(currentWeightKg) ||
    currentWeightKg < 20 ||
    currentWeightKg > 500
  ) {
    return {
      error: "Current weight must be a number between 20 and 500 kilograms.",
    };
  }

  if (
    typeof activityLevel !== "string" ||
    !activityLevels.includes(activityLevel as ActivityLevel)
  ) {
    return { error: "Activity level is invalid." };
  }

  if (
    typeof fitnessGoal !== "string" ||
    !fitnessGoals.includes(fitnessGoal as FitnessGoal)
  ) {
    return { error: "Fitness goal is invalid." };
  }

  return {
    value: {
      age,
      heightCm,
      currentWeightKg,
      activityLevel: activityLevel as ActivityLevel,
      fitnessGoal: fitnessGoal as FitnessGoal,
    },
  };
}

function serializeProfile(profile: {
  age: number | null;
  heightCm: string | null;
  currentWeightKg: string | null;
  activityLevel: ActivityLevel | null;
  fitnessGoal: FitnessGoal | null;
}) {
  return {
    age: profile.age,
    heightCm: profile.heightCm === null ? null : Number(profile.heightCm),
    currentWeightKg:
      profile.currentWeightKg === null ? null : Number(profile.currentWeightKg),
    activityLevel: profile.activityLevel,
    fitnessGoal: profile.fitnessGoal,
  };
}

meRouter.get("/me", requireAuthenticatedUser, async (request, response) => {
  const clerkUserId = getAuthenticatedClerkUserId(request);

  try {
    await db
      .insert(users)
      .values({ clerkUserId })
      .onConflictDoNothing({ target: users.clerkUserId });

    const [result] = await db
      .select({ ...userResponseFields, ...profileResponseFields })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!result) {
      throw new Error("FitPath user was not available after synchronization");
    }

    response.status(200).json({
      id: result.id,
      role: result.role,
      onboardingCompleted: result.onboardingCompleted,
      profile: result.profileId ? serializeProfile(result) : null,
    });
  } catch {
    console.error("Failed to synchronize FitPath user");
    response.status(500).json({ error: "Internal server error" });
  }
});

meRouter.put(
  "/me/onboarding",
  requireAuthenticatedUser,
  async (request, response) => {
    const validation = validateOnboardingInput(request.body);

    if ("error" in validation) {
      response.status(400).json({ error: validation.error });
      return;
    }

    const clerkUserId = getAuthenticatedClerkUserId(request);
    const now = new Date();
    const profileValues = {
      ...validation.value,
      heightCm: validation.value.heightCm.toString(),
      currentWeightKg: validation.value.currentWeightKg.toString(),
    };

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

      if (user.role !== "USER") {
        response
          .status(403)
          .json({ error: "Onboarding is only available to FitPath users." });
        return;
      }

      // Neon HTTP executes a Drizzle batch as one database transaction.
      const [profileResults, userResults] = await db.batch([
        db
          .insert(profiles)
          .values({
            ...profileValues,
            userId: user.id,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: profiles.userId,
            set: { ...profileValues, updatedAt: now },
          })
          .returning(profileResponseFields),
        db
          .update(users)
          .set({ onboardingCompleted: true, updatedAt: now })
          .where(eq(users.id, user.id))
          .returning(userResponseFields),
      ]);

      const [profile] = profileResults;
      const [completedUser] = userResults;

      if (!profile || !completedUser) {
        throw new Error("Onboarding update did not return expected data");
      }

      response.status(200).json({
        user: completedUser,
        profile: serializeProfile(profile),
      });
    } catch {
      console.error("Failed to complete onboarding");
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

export { meRouter };
