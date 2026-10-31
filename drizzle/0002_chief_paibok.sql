CREATE TYPE "public"."training_plan_status" AS ENUM('DRAFT', 'ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "exercises_name_not_blank" CHECK (length(btrim("exercises"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"client_user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "training_plan_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_plans_title_not_blank" CHECK (length(btrim("training_plans"."title")) > 0),
	CONSTRAINT "training_plans_goal_not_blank" CHECK (length(btrim("training_plans"."goal")) > 0),
	CONSTRAINT "training_plans_date_range" CHECK ("training_plans"."end_date" >= "training_plans"."start_date")
);
--> statement-breakpoint
CREATE TABLE "workout_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "workout_days_name_not_blank" CHECK (length(btrim("workout_days"."name")) > 0),
	CONSTRAINT "workout_days_position_positive" CHECK ("workout_days"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_day_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sets" smallint NOT NULL,
	"repetitions" smallint NOT NULL,
	"weight_kg" numeric(6, 2),
	"rest_seconds" integer,
	"notes" text,
	"position" smallint NOT NULL,
	CONSTRAINT "workout_exercises_sets_positive" CHECK ("workout_exercises"."sets" > 0),
	CONSTRAINT "workout_exercises_repetitions_positive" CHECK ("workout_exercises"."repetitions" > 0),
	CONSTRAINT "workout_exercises_weight_non_negative" CHECK ("workout_exercises"."weight_kg" IS NULL OR "workout_exercises"."weight_kg" >= 0),
	CONSTRAINT "workout_exercises_rest_non_negative" CHECK ("workout_exercises"."rest_seconds" IS NULL OR "workout_exercises"."rest_seconds" >= 0),
	CONSTRAINT "workout_exercises_position_positive" CHECK ("workout_exercises"."position" > 0)
);
--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_days" ADD CONSTRAINT "workout_days_training_plan_id_training_plans_id_fk" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_day_id_workout_days_id_fk" FOREIGN KEY ("workout_day_id") REFERENCES "public"."workout_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_plans_client_status_idx" ON "training_plans" USING btree ("client_user_id","status");--> statement-breakpoint
CREATE INDEX "training_plans_created_by_user_idx" ON "training_plans" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_days_plan_position_unique" ON "workout_days" USING btree ("training_plan_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_exercises_day_position_unique" ON "workout_exercises" USING btree ("workout_day_id","position");--> statement-breakpoint
CREATE INDEX "workout_exercises_exercise_idx" ON "workout_exercises" USING btree ("exercise_id");