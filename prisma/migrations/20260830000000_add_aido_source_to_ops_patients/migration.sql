ALTER TABLE "ops_patients"
  ADD COLUMN "aido_hospital_id" TEXT,
  ADD COLUMN "aido_external_patient_id" TEXT,
  ADD COLUMN "aido_external_numeric_id" TEXT,
  ADD COLUMN "mr_number" TEXT;

CREATE INDEX "ops_patients_branch_id_aido_hospital_id_aido_external_patient_id_idx"
  ON "ops_patients"("branch_id", "aido_hospital_id", "aido_external_patient_id");

CREATE INDEX "ops_patients_branch_id_mr_number_idx"
  ON "ops_patients"("branch_id", "mr_number");
