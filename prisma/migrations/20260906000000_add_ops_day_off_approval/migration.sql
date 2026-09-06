-- Add approval workflow to staff day offs.
-- Existing rows and manager-created rows stay APPROVED by default.

CREATE TYPE "OpsDayOffStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "ops_staff_day_offs"
  ADD COLUMN "status" "OpsDayOffStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "approved_by_id" TEXT,
  ADD COLUMN "approved_at" TIMESTAMPTZ(3);

CREATE INDEX "ops_staff_day_offs_status_date_idx" ON "ops_staff_day_offs"("status", "date");

ALTER TABLE "ops_staff_day_offs"
  ADD CONSTRAINT "ops_staff_day_offs_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "ops_staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
