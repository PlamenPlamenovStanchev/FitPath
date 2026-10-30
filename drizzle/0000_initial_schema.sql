CREATE TYPE "public"."activity_level" AS ENUM('SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE');--> statement-breakpoint
CREATE TYPE "public"."fitness_goal" AS ENUM('LOSE_WEIGHT', 'BUILD_MUSCLE', 'IMPROVE_FITNESS', 'MAINTAIN_CONDITION');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'TRAINER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"age" smallint,
	"height_cm" numeric(5, 2),
	"current_weight_kg" numeric(5, 2),
	"activity_level" "activity_level",
	"fitness_goal" "fitness_goal",
	"avatar_object_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "profiles_age_range" CHECK ("profiles"."age" IS NULL OR "profiles"."age" BETWEEN 13 AND 120),
	CONSTRAINT "profiles_height_range" CHECK ("profiles"."height_cm" IS NULL OR "profiles"."height_cm" BETWEEN 50 AND 300),
	CONSTRAINT "profiles_weight_range" CHECK ("profiles"."current_weight_kg" IS NULL OR "profiles"."current_weight_kg" BETWEEN 20 AND 500)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");