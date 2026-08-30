CREATE TYPE "OpsPatientSource" AS ENUM ('AIDO', 'MANUAL');
CREATE TYPE "OpsManualPatientReason" AS ENUM ('AIDO_UNAVAILABLE', 'NOT_IN_AIDO', 'AIDO_DATA_MISMATCH', 'OTHER');

ALTER TABLE "ops_patients"
  ADD COLUMN "source" "OpsPatientSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "manual_entry_reason" "OpsManualPatientReason",
  ADD COLUMN "manual_entry_note" TEXT;

CREATE INDEX "ops_patients_branch_id_source_name_idx"
  ON "ops_patients"("branch_id", "source", "name");
