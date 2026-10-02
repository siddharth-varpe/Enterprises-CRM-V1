-- SR Enterprises CRM — Technician Portal Additive Migration
-- Phase 0: Scaffolding for Portal Access, Notifications & OTP Challenges
-- Strictly additive and non-breaking to existing CRM schema.

CREATE TABLE IF NOT EXISTS "technician_portal_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"portal_enabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technician_portal_access_technician_id_unique" UNIQUE("technician_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "technician_portal_access" ADD CONSTRAINT "technician_portal_access_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tech_portal_access_tech_idx" ON "technician_portal_access" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tech_portal_access_enabled_idx" ON "technician_portal_access" USING btree ("portal_enabled");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "technician_portal_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"dedup_key" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "technician_portal_notifications" ADD CONSTRAINT "technician_portal_notifications_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tech_portal_notifications_tech_idx" ON "technician_portal_notifications" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tech_portal_notifications_unread_idx" ON "technician_portal_notifications" USING btree ("technician_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tech_portal_notifications_dedup_idx" ON "technician_portal_notifications" USING btree ("technician_id","dedup_key");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "technician_otp_challenges" (
	"challenge_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"otp_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "technician_otp_challenges" ADD CONSTRAINT "technician_otp_challenges_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tech_otp_challenges_tech_exp_idx" ON "technician_otp_challenges" USING btree ("technician_id","expires_at");
