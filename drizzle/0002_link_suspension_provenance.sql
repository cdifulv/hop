ALTER TABLE "links" ADD COLUMN "direct_suspended_by_member_id" uuid;
--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "direct_suspended_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "owner_suspended_by_member_id" uuid;
--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "owner_suspended_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "links"
SET "direct_suspended_at" = "suspended_at"
WHERE "lifecycle_state" = 'suspended'
  AND "suspended_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_direct_suspended_by_member_id_members_id_fk" FOREIGN KEY ("direct_suspended_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_owner_suspended_by_member_id_members_id_fk" FOREIGN KEY ("owner_suspended_by_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "links_direct_suspended_at_idx" ON "links" USING btree ("direct_suspended_at");
--> statement-breakpoint
CREATE INDEX "links_owner_suspended_at_idx" ON "links" USING btree ("owner_suspended_at");
