CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"kind" text NOT NULL,
	"transaction_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_number_idx" ON "documents" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_transaction_idx" ON "documents" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
-- Factures et reçus des recharges et retraits déjà validés : numérotés par type et par année, dans l'ordre des dates.
INSERT INTO "documents" ("id", "number", "kind", "transaction_id", "user_id", "amount", "created_at")
SELECT substr(md5('document:' || t."id"), 1, 16),
  (CASE WHEN t."type" = 'recharge' THEN 'FAC-' ELSE 'REC-' END) || to_char(t."created_at" AT TIME ZONE 'UTC', 'YYYY') || '-'
    || lpad((row_number() OVER (PARTITION BY t."type", to_char(t."created_at" AT TIME ZONE 'UTC', 'YYYY') ORDER BY t."created_at", t."id"))::text, 5, '0'),
  CASE WHEN t."type" = 'recharge' THEN 'facture' ELSE 'recu' END, t."id", t."user_id", abs(t."amount"), t."created_at"
FROM "transactions" t
WHERE t."status" = 'Validé' AND t."type" IN ('recharge', 'retrait');
