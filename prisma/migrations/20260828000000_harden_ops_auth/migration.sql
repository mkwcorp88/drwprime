ALTER TABLE "ops_staff"
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "password_changed_at" TIMESTAMPTZ(3),
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMPTZ(3);

ALTER TABLE "ops_doctors"
  ADD CONSTRAINT "ops_doctors_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "ops_staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
