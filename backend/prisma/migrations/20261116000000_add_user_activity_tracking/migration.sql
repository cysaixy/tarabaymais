-- Track account activity so accounts idle for 6 months can be marked inactive.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: best evidence of past activity is the newest of the user's own
-- record update, observations and plant scans.
UPDATE "users" u
SET "last_active_at" = GREATEST(
  u."updated_at",
  COALESCE((SELECT MAX(o."created_at") FROM "observations" o WHERE o."farmer_id" = u."id"), u."created_at"),
  COALESCE((SELECT MAX(p."created_at") FROM "plant_scans" p WHERE p."farmer_id" = u."id"), u."created_at")
);

-- Mark accounts already idle for 6 months.
UPDATE "users"
SET "is_active" = false
WHERE "last_active_at" < now() - INTERVAL '6 months';

CREATE INDEX IF NOT EXISTS "idx_users_is_active_last_active_at"
  ON "users" ("is_active", "last_active_at");
