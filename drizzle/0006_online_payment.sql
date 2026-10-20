ALTER TABLE "transactions" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "provider_ref" text;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_provider_ref_idx" ON "transactions" USING btree ("provider_ref");