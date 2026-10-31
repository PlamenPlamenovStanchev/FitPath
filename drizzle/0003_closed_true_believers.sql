CREATE TABLE "progress_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weight_kg" numeric(5, 2) NOT NULL,
	"bmi" numeric(5, 2) NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_entries_weight_positive" CHECK ("progress_entries"."weight_kg" > 0),
	CONSTRAINT "progress_entries_bmi_positive" CHECK ("progress_entries"."bmi" > 0)
);
--> statement-breakpoint
CREATE TABLE "progress_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_photos_object_key_not_blank" CHECK (length(btrim("progress_photos"."object_key")) > 0)
);
--> statement-breakpoint
CREATE TABLE "workout_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workout_day_id" uuid NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_completions" ADD CONSTRAINT "workout_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_completions" ADD CONSTRAINT "workout_completions_workout_day_id_workout_days_id_fk" FOREIGN KEY ("workout_day_id") REFERENCES "public"."workout_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "progress_entries_user_recorded_at_idx" ON "progress_entries" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "progress_photos_user_created_at_idx" ON "progress_photos" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_completions_user_day_unique" ON "workout_completions" USING btree ("user_id","workout_day_id");--> statement-breakpoint
CREATE INDEX "workout_completions_user_completed_at_idx" ON "workout_completions" USING btree ("user_id","completed_at");