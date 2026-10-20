CREATE TABLE "job_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "view_snapshots" (
	"publication_id" text NOT NULL,
	"day" text NOT NULL,
	"views" integer NOT NULL,
	"likes" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "view_snapshots_publication_id_day_pk" PRIMARY KEY("publication_id","day")
);
--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "likes" integer;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "risk_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "view_snapshots" ADD CONSTRAINT "view_snapshots_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "view_snapshots_day_idx" ON "view_snapshots" USING btree ("day");--> statement-breakpoint
-- Clips existants : leurs vues actuelles deviennent le premier jour de leur historique (point de départ des vues gagnées).
INSERT INTO "view_snapshots" ("publication_id", "day", "views", "likes", "recorded_at")
SELECT "id", to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'), "views", NULL, now() FROM "publications";
