ALTER TABLE "progress_entries" ADD COLUMN "training_plan_id" uuid;
--> statement-breakpoint
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_training_plan_id_training_plans_id_fk" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "progress_entries_user_plan_recorded_at_idx" ON "progress_entries" USING btree ("user_id","training_plan_id","recorded_at");
