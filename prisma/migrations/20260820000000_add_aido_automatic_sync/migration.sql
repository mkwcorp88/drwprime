-- Stable AIDO patient links and idempotent income synchronization.
ALTER TABLE "spending_records"
  ADD COLUMN IF NOT EXISTS "external_id" TEXT,
  ADD COLUMN IF NOT EXISTS "registration_number" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "spending_records" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Rebuild denormalized spending aggregates before the new canonical readers use
-- them. Reservation completion does not create a SpendingRecord, so both
-- sources are included exactly once.
-- Block aggregate writers while the snapshot is rebuilt; readers can continue
-- using the old application during the expand phase.
LOCK TABLE "users", "reservations", "spending_records" IN SHARE ROW EXCLUSIVE MODE;

WITH aggregate_totals AS (
  SELECT
    u."id",
    COALESCE((
      SELECT SUM(r."final_price")
      FROM "reservations" r
      WHERE r."userId" = u."id" AND r."status" = 'completed'
    ), 0) + COALESCE((
      SELECT SUM(s."amount")
      FROM "spending_records" s
      WHERE s."userId" = u."id"
    ), 0) AS "total_spending",
    GREATEST(
      COALESCE((
        SELECT MAX(s."spendingDate")
        FROM "spending_records" s
        WHERE s."userId" = u."id"
      ), '-infinity'::timestamp),
      COALESCE((
        SELECT MAX(r."completedAt")
        FROM "reservations" r
        WHERE r."userId" = u."id" AND r."status" = 'completed'
      ), '-infinity'::timestamp)
    ) AS "last_transaction_at"
  FROM "users" u
)
UPDATE "users" u
SET
  "total_spending" = a."total_spending",
  "last_transaction_at" = NULLIF(a."last_transaction_at", '-infinity'::timestamp),
  "loyalty_level" = CASE
    WHEN a."total_spending" >= 10000000 THEN 'Platinum'
    WHEN a."total_spending" >= 5000000 THEN 'Gold'
    WHEN a."total_spending" >= 1000000 THEN 'Silver'
    ELSE 'Bronze'
  END
FROM aggregate_totals a
WHERE u."id" = a."id";

-- Normalize legacy Indonesian phone formats where doing so cannot collide with
-- another unique phone value. Ambiguous duplicates remain for manual review.
WITH normalized AS (
  SELECT
    u."id",
    CASE
      WHEN length(regexp_replace(u."phone", '[^0-9]', '', 'g')) BETWEEN 10 AND 15
        AND regexp_replace(u."phone", '[^0-9]', '', 'g') LIKE '62%'
        THEN regexp_replace(u."phone", '[^0-9]', '', 'g')
      WHEN length(regexp_replace(u."phone", '[^0-9]', '', 'g')) BETWEEN 9 AND 14
        AND regexp_replace(u."phone", '[^0-9]', '', 'g') LIKE '0%'
        THEN '62' || substring(regexp_replace(u."phone", '[^0-9]', '', 'g') FROM 2)
      WHEN length(regexp_replace(u."phone", '[^0-9]', '', 'g')) BETWEEN 8 AND 13
        AND regexp_replace(u."phone", '[^0-9]', '', 'g') LIKE '8%'
        THEN '62' || regexp_replace(u."phone", '[^0-9]', '', 'g')
      ELSE NULL
    END AS "normalized_phone"
  FROM "users" u
  WHERE u."phone" IS NOT NULL
), safe AS (
  SELECT n.*
  FROM normalized n
  WHERE n."normalized_phone" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM normalized n2
      WHERE n2."normalized_phone" = n."normalized_phone" AND n2."id" <> n."id"
    )
    AND NOT EXISTS (
      SELECT 1 FROM "users" u2
      WHERE u2."phone" = n."normalized_phone" AND u2."id" <> n."id"
    )
)
UPDATE "users" u
SET "phone" = s."normalized_phone"
FROM safe s
WHERE u."id" = s."id" AND u."phone" <> s."normalized_phone";

CREATE UNIQUE INDEX IF NOT EXISTS "spending_records_source_external_id_key"
  ON "spending_records"("source", "external_id");

CREATE TABLE IF NOT EXISTS "aido_patient_links" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "hospital_id" TEXT NOT NULL,
  "external_patient_id" TEXT NOT NULL,
  "external_patient_numeric_id" TEXT,
  "mr_number" TEXT,
  "last_synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "aido_patient_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aido_patient_links_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "aido_patient_links_hospital_id_external_patient_id_key"
  ON "aido_patient_links"("hospital_id", "external_patient_id");
CREATE UNIQUE INDEX IF NOT EXISTS "aido_patient_links_hospital_id_external_patient_numeric_id_key"
  ON "aido_patient_links"("hospital_id", "external_patient_numeric_id");
CREATE INDEX IF NOT EXISTS "aido_patient_links_user_id_idx"
  ON "aido_patient_links"("user_id");
CREATE INDEX IF NOT EXISTS "aido_patient_links_hospital_id_mr_number_idx"
  ON "aido_patient_links"("hospital_id", "mr_number");

CREATE TABLE IF NOT EXISTS "aido_sync_runs" (
  "id" TEXT NOT NULL,
  "sync_date" TEXT NOT NULL,
  "hospital_id" TEXT,
  "mode" TEXT NOT NULL DEFAULT 'scheduled',
  "status" TEXT NOT NULL,
  "patients_fetched" INTEGER NOT NULL DEFAULT 0,
  "patients_created" INTEGER NOT NULL DEFAULT 0,
  "patients_updated" INTEGER NOT NULL DEFAULT 0,
  "patient_conflicts" INTEGER NOT NULL DEFAULT 0,
  "incomes_fetched" INTEGER NOT NULL DEFAULT 0,
  "incomes_created" INTEGER NOT NULL DEFAULT 0,
  "incomes_updated" INTEGER NOT NULL DEFAULT 0,
  "incomes_removed" INTEGER NOT NULL DEFAULT 0,
  "incomes_unmatched" INTEGER NOT NULL DEFAULT 0,
  "invalid_rows" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "aido_sync_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "aido_sync_runs" ADD COLUMN IF NOT EXISTS "hospital_id" TEXT;

CREATE INDEX IF NOT EXISTS "aido_sync_runs_sync_date_started_at_idx"
  ON "aido_sync_runs"("sync_date", "started_at");
CREATE INDEX IF NOT EXISTS "aido_sync_runs_status_idx"
  ON "aido_sync_runs"("status");

CREATE TABLE IF NOT EXISTS "aido_sync_locks" (
  "name" TEXT NOT NULL,
  "owner" TEXT,
  "locked_until" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "aido_sync_locks_pkey" PRIMARY KEY ("name")
);
