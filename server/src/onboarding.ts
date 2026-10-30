import type { profiles } from "./db/schema.js";

type ProfileForOnboarding = Pick<
  typeof profiles.$inferSelect,
  "age" | "heightCm" | "currentWeightKg" | "activityLevel" | "fitnessGoal"
>;

const requiredProfileFields: ReadonlyArray<
  readonly [keyof ProfileForOnboarding, string]
> = [
  ["age", "age"],
  ["heightCm", "heightCm"],
  ["currentWeightKg", "currentWeightKg"],
  ["activityLevel", "activityLevel"],
  ["fitnessGoal", "fitnessGoal"],
];

export function assertProfileReadyForOnboarding(
  profile: ProfileForOnboarding,
): void {
  const missingFields = requiredProfileFields
    .filter(([field]) => profile[field] === null)
    .map(([, label]) => label);

  if (missingFields.length > 0) {
    throw new Error(
      `Cannot complete onboarding. Missing profile fields: ${missingFields.join(", ")}`,
    );
  }
}
