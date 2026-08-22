-- Keep the complete AIDO income snapshot independent from loyalty projections.
CREATE TABLE IF NOT EXISTS "aido_income_records" (
  "id" TEXT NOT NULL,
  "hospital_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "external_patient_id" TEXT,
  "external_patient_numeric_id" TEXT,
  "mr_number" TEXT,
  "patient_name" TEXT,
  "registration_number" TEXT,
  "receipt_number" TEXT,
  "transaction_date" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "treatment" TEXT,
  "sync_date" TEXT NOT NULL,
  "match_status" TEXT NOT NULL DEFAULT 'UNMATCHED',
  "matched_user_id" TEXT,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "aido_income_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aido_income_records_matched_user_id_fkey"
    FOREIGN KEY ("matched_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "aido_income_records_hospital_id_external_id_key"
  ON "aido_income_records"("hospital_id", "external_id");
CREATE INDEX IF NOT EXISTS "aido_income_records_hospital_id_transaction_date_idx"
  ON "aido_income_records"("hospital_id", "transaction_date");
CREATE INDEX IF NOT EXISTS "aido_income_records_hospital_id_sync_date_match_status_idx"
  ON "aido_income_records"("hospital_id", "sync_date", "match_status");
CREATE INDEX IF NOT EXISTS "aido_income_records_matched_user_id_idx"
  ON "aido_income_records"("matched_user_id");

ALTER TABLE "aido_sync_runs"
  ADD COLUMN IF NOT EXISTS "income_ledger_created" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "income_ledger_updated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "income_ledger_removed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "incomes_matched" INTEGER NOT NULL DEFAULT 0;
