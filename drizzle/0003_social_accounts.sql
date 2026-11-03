CREATE TABLE "social_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"handle" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_user_platform_idx" ON "social_accounts" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_code_idx" ON "social_accounts" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_verified_handle_idx" ON "social_accounts" USING btree ("platform","handle") WHERE "social_accounts"."status" = 'verified';