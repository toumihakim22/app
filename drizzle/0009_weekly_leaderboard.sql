CREATE TABLE "weekly_awards" (
	"week" text NOT NULL,
	"rank" integer NOT NULL,
	"user_id" text NOT NULL,
	"views" integer NOT NULL,
	"amount" integer NOT NULL,
	"transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_awards_week_rank_pk" PRIMARY KEY("week","rank")
);
--> statement-breakpoint
ALTER TABLE "weekly_awards" ADD CONSTRAINT "weekly_awards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_awards" ADD CONSTRAINT "weekly_awards_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "weekly_awards_user_idx" ON "weekly_awards" USING btree ("user_id");