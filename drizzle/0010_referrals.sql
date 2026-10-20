CREATE TABLE "referral_rewards" (
	"referee_id" text PRIMARY KEY NOT NULL,
	"referrer_id" text NOT NULL,
	"amount" integer NOT NULL,
	"transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by" text;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_rewards_referrer_idx" ON "referral_rewards" USING btree ("referrer_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_users_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_referral_code_idx" ON "users" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "users_referred_by_idx" ON "users" USING btree ("referred_by");--> statement-breakpoint
-- Codes de parrainage des clippers déjà inscrits : 8 signes tirés de l'empreinte md5 de leur identifiant (chiffres et lettres A à F, en majuscules).
UPDATE "users" SET "referral_code" = upper(substr(md5("id" || ':parrainage'), 1, 8)) WHERE "role" = 'clipper' AND "referral_code" IS NULL;
