CREATE TYPE "OpsProtocolApprovalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED');
CREATE TYPE "OpsTreatmentMappingStatus" AS ENUM ('EXACT_NAME', 'PENDING_CONFIRMATION', 'CONFIRMED');

CREATE TABLE "ops_treatment_protocols" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "approval_status" "OpsProtocolApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "ops_treatment_protocols_code_key" ON "ops_treatment_protocols"("code");
CREATE INDEX "ops_treatment_protocols_approval_status_idx" ON "ops_treatment_protocols"("approval_status");

CREATE TABLE "ops_treatment_protocol_steps" (
  "id" TEXT PRIMARY KEY,
  "protocol_id" TEXT NOT NULL,
  "step_code" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "default_role" TEXT,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "ops_treatment_protocol_steps_step_code_key" ON "ops_treatment_protocol_steps"("step_code");
CREATE UNIQUE INDEX "ops_treatment_protocol_steps_protocol_id_sequence_key" ON "ops_treatment_protocol_steps"("protocol_id", "sequence");

ALTER TABLE "ops_treatment_protocol_steps"
  ADD CONSTRAINT "ops_treatment_protocol_steps_protocol_id_fkey"
  FOREIGN KEY ("protocol_id") REFERENCES "ops_treatment_protocols"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_treatment_protocols"
  ADD CONSTRAINT "ops_treatment_protocols_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "ops_staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_treatments"
  ADD COLUMN "protocol_id" TEXT,
  ADD COLUMN "mapping_status" "OpsTreatmentMappingStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  ADD COLUMN "requires_doctor" BOOLEAN,
  ADD COLUMN "staff_fee_idr" INTEGER,
  ADD COLUMN "doctor_fee_idr" INTEGER;

ALTER TABLE "ops_treatments"
  ADD CONSTRAINT "ops_treatments_protocol_id_fkey"
  FOREIGN KEY ("protocol_id") REFERENCES "ops_treatment_protocols"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ops_treatments_protocol_id_idx" ON "ops_treatments"("protocol_id");
CREATE INDEX "ops_treatments_mapping_status_idx" ON "ops_treatments"("mapping_status");
