import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
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

export const trainerApplicationStatusEnum = pgEnum(
  "trainer_application_status",
  ["PENDING", "APPROVED", "REJECTED"],
);

export const trainingPlanStatusEnum = pgEnum("training_plan_status", [
  "DRAFT",
  "ACTIVE",
  "COMPLETED",
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

export const trainerApplications = pgTable(
  "trainer_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: trainerApplicationStatusEnum("status").notNull().default("PENDING"),
    specialization: text("specialization").notNull(),
    biography: text("biography").notNull(),
    certificateObjectKey: text("certificate_object_key").notNull(),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      mode: "date",
    }),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("trainer_applications_one_pending_per_user_idx")
      .on(table.userId)
      .where(sql`${table.status} = 'PENDING'`),
    index("trainer_applications_pending_review_idx")
      .on(table.submittedAt)
      .where(sql`${table.status} = 'PENDING'`),
    check(
      "trainer_applications_review_metadata",
      sql`(
        ${table.status} = 'PENDING'
        AND ${table.reviewedAt} IS NULL
        AND ${table.reviewedBy} IS NULL
      ) OR (
        ${table.status} IN ('APPROVED', 'REJECTED')
        AND ${table.reviewedAt} IS NOT NULL
        AND ${table.reviewedBy} IS NOT NULL
      )`,
    ),
  ],
);

export const trainerProfiles = pgTable(
  "trainer_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    specialization: text("specialization").notNull(),
    biography: text("biography").notNull(),
    profilePhotoObjectKey: text("profile_photo_object_key"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // Application update operations must explicitly set this value; no trigger is used.
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
);

export const trainerAssignments = pgTable(
  "trainer_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trainerUserId: uuid("trainer_user_id")
      .notNull()
      .references(() => users.id),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("trainer_assignments_one_active_trainer_per_client_idx")
      .on(table.clientUserId)
      .where(sql`${table.active} = true`),
    index("trainer_assignments_active_trainer_idx")
      .on(table.trainerUserId)
      .where(sql`${table.active} = true`),
    check(
      "trainer_assignments_distinct_users",
      sql`${table.trainerUserId} <> ${table.clientUserId}`,
    ),
    check(
      "trainer_assignments_lifecycle",
      sql`(
        ${table.active} = true
        AND ${table.endedAt} IS NULL
      ) OR (
        ${table.active} = false
        AND ${table.endedAt} IS NOT NULL
        AND ${table.endedAt} >= ${table.createdAt}
      )`,
    ),
  ],
);

export const trainingPlans = pgTable(
  "training_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    // This is a plan-specific objective, separate from the profile fitness goal.
    goal: text("goal").notNull(),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: trainingPlanStatusEnum("status").notNull().default("DRAFT"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // Application update operations must explicitly set this value; no trigger is used.
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("training_plans_client_status_idx").on(
      table.clientUserId,
      table.status,
    ),
    index("training_plans_created_by_user_idx").on(table.createdByUserId),
    check("training_plans_title_not_blank", sql`length(btrim(${table.title})) > 0`),
    check("training_plans_goal_not_blank", sql`length(btrim(${table.goal})) > 0`),
    check("training_plans_date_range", sql`${table.endDate} >= ${table.startDate}`),
  ],
);

export const workoutDays = pgTable(
  "workout_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trainingPlanId: uuid("training_plan_id")
      .notNull()
      .references(() => trainingPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: smallint("position").notNull(),
  },
  (table) => [
    uniqueIndex("workout_days_plan_position_unique").on(
      table.trainingPlanId,
      table.position,
    ),
    check("workout_days_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check("workout_days_position_positive", sql`${table.position} > 0`),
  ],
);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (table) => [
    check("exercises_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutDayId: uuid("workout_day_id")
      .notNull()
      .references(() => workoutDays.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    sets: smallint("sets").notNull(),
    repetitions: smallint("repetitions").notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2 }),
    restSeconds: integer("rest_seconds"),
    notes: text("notes"),
    position: smallint("position").notNull(),
  },
  (table) => [
    uniqueIndex("workout_exercises_day_position_unique").on(
      table.workoutDayId,
      table.position,
    ),
    index("workout_exercises_exercise_idx").on(table.exerciseId),
    check("workout_exercises_sets_positive", sql`${table.sets} > 0`),
    check(
      "workout_exercises_repetitions_positive",
      sql`${table.repetitions} > 0`,
    ),
    check(
      "workout_exercises_weight_non_negative",
      sql`${table.weightKg} IS NULL OR ${table.weightKg} >= 0`,
    ),
    check(
      "workout_exercises_rest_non_negative",
      sql`${table.restSeconds} IS NULL OR ${table.restSeconds} >= 0`,
    ),
    check(
      "workout_exercises_position_positive",
      sql`${table.position} > 0`,
    ),
  ],
);

export const progressEntries = pgTable(
  "progress_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }).notNull(),
    bmi: numeric("bmi", { precision: 5, scale: 2 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("progress_entries_user_recorded_at_idx").on(
      table.userId,
      table.recordedAt,
    ),
    check("progress_entries_weight_positive", sql`${table.weightKg} > 0`),
    check("progress_entries_bmi_positive", sql`${table.bmi} > 0`),
  ],
);

export const workoutCompletions = pgTable(
  "workout_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    workoutDayId: uuid("workout_day_id")
      .notNull()
      .references(() => workoutDays.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("workout_completions_user_day_unique").on(
      table.userId,
      table.workoutDayId,
    ),
    index("workout_completions_user_completed_at_idx").on(
      table.userId,
      table.completedAt,
    ),
  ],
);

export const progressPhotos = pgTable(
  "progress_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    objectKey: text("object_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("progress_photos_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    check(
      "progress_photos_object_key_not_blank",
      sql`length(btrim(${table.objectKey})) > 0`,
    ),
  ],
);
