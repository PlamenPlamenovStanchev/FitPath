import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["USER", "TRAINER", "ADMIN"]);

export const activityLevelEnum = pgEnum("activity_level", [
  "SEDENTARY",
  "LIGHTLY_ACTIVE",
  "MODERATELY_ACTIVE",
  "VERY_ACTIVE",
]);

export const fitnessGoalEnum = pgEnum("fitness_goal", [
  "LOSE_WEIGHT",
  "BUILD_MUSCLE",
  "IMPROVE_FITNESS",
  "MAINTAIN_CONDITION",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    role: userRoleEnum("role").notNull().default("USER"),
    onboardingCompleted: boolean("onboarding_completed")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // Application update operations must explicitly set this value; no trigger is used.
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("users_role_idx").on(table.role)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    // These fields remain nullable until onboarding is completed by application logic.
    age: smallint("age"),
    heightCm: numeric("height_cm", { precision: 5, scale: 2 }),
    currentWeightKg: numeric("current_weight_kg", { precision: 5, scale: 2 }),
    activityLevel: activityLevelEnum("activity_level"),
    fitnessGoal: fitnessGoalEnum("fitness_goal"),
    avatarObjectKey: text("avatar_object_key"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // Application update operations must explicitly set this value; no trigger is used.
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "profiles_age_range",
      sql`${table.age} IS NULL OR ${table.age} BETWEEN 13 AND 120`,
    ),
    check(
      "profiles_height_range",
      sql`${table.heightCm} IS NULL OR ${table.heightCm} BETWEEN 50 AND 300`,
    ),
    check(
      "profiles_weight_range",
      sql`${table.currentWeightKg} IS NULL OR ${table.currentWeightKg} BETWEEN 20 AND 500`,
    ),
  ],
);
