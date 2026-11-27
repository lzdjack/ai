DROP INDEX "node_runs_attempt_key";--> statement-breakpoint
ALTER TABLE "node_runs" ADD COLUMN "repo_id" uuid;--> statement-breakpoint
ALTER TABLE "node_runs" ADD COLUMN "error_raw" text;--> statement-breakpoint
ALTER TABLE "node_runs" ADD CONSTRAINT "node_runs_attempt_key" UNIQUE NULLS NOT DISTINCT("flow_instance_id","node_key","attempt_no","repo_id");