CREATE TABLE "ops_login_otps" (
  "id" TEXT NOT NULL,
  "staff_id" TEXT,
  "phone_hash" TEXT NOT NULL,
  "request_ip_hash" TEXT,
  "code_hash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_login_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_login_otps_phone_hash_created_at_idx" ON "ops_login_otps"("phone_hash", "created_at");
CREATE INDEX "ops_login_otps_request_ip_hash_created_at_idx" ON "ops_login_otps"("request_ip_hash", "created_at");
CREATE INDEX "ops_login_otps_staff_id_created_at_idx" ON "ops_login_otps"("staff_id", "created_at");
CREATE INDEX "ops_login_otps_expires_at_idx" ON "ops_login_otps"("expires_at");

ALTER TABLE "ops_login_otps"
  ADD CONSTRAINT "ops_login_otps_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "ops_staff"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
