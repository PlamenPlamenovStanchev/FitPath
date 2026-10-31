CREATE TYPE "public"."trainer_application_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "trainer_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "trainer_application_status" DEFAULT 'PENDING' NOT NULL,
	"specialization" text NOT NULL,
	"biography" text NOT NULL,
	"certificate_object_key" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	CONSTRAINT "trainer_applications_review_metadata" CHECK ((
        "trainer_applications"."status" = 'PENDING'
        AND "trainer_applications"."reviewed_at" IS NULL
        AND "trainer_applications"."reviewed_by" IS NULL
      ) OR (
        "trainer_applications"."status" IN ('APPROVED', 'REJECTED')
        AND "trainer_applications"."reviewed_at" IS NOT NULL
        AND "trainer_applications"."reviewed_by" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "trainer_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_user_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "trainer_assignments_distinct_users" CHECK ("trainer_assignments"."trainer_user_id" <> "trainer_assignments"."client_user_id"),
	CONSTRAINT "trainer_assignments_lifecycle" CHECK ((
        "trainer_assignments"."active" = true
        AND "trainer_assignments"."ended_at" IS NULL
      ) OR (
        "trainer_assignments"."active" = false
        AND "trainer_assignments"."ended_at" IS NOT NULL
        AND "trainer_assignments"."ended_at" >= "trainer_assignments"."created_at"
      ))
);
--> statement-breakpoint
CREATE TABLE "trainer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"specialization" text NOT NULL,
	"biography" text NOT NULL,
	"profile_photo_object_key" text,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trainer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "trainer_applications" ADD CONSTRAINT "trainer_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_applications" ADD CONSTRAINT "trainer_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_assignments" ADD CONSTRAINT "trainer_assignments_trainer_user_id_users_id_fk" FOREIGN KEY ("trainer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_assignments" ADD CONSTRAINT "trainer_assignments_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_profiles" ADD CONSTRAINT "trainer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trainer_applications_one_pending_per_user_idx" ON "trainer_applications" USING btree ("user_id") WHERE "trainer_applications"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "trainer_applications_pending_review_idx" ON "trainer_applications" USING btree ("submitted_at") WHERE "trainer_applications"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "trainer_assignments_one_active_trainer_per_client_idx" ON "trainer_assignments" USING btree ("client_user_id") WHERE "trainer_assignments"."active" = true;--> statement-breakpoint
CREATE INDEX "trainer_assignments_active_trainer_idx" ON "trainer_assignments" USING btree ("trainer_user_id") WHERE "trainer_assignments"."active" = true;