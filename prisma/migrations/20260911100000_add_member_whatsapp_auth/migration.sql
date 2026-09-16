-- Additive migration: retain Clerk IDs and all member/financial relationships.
ALTER TABLE "users"
  ADD COLUMN "login_phone" TEXT,
  ADD COLUMN "login_phone_verified_at" TIMESTAMP(3),
  ADD COLUMN "member_login_blocked_at" TIMESTAMP(3),
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "avatar_key" TEXT;
CREATE UNIQUE INDEX "users_login_phone_key" ON "users"("login_phone");

CREATE TABLE "member_sessions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "member_sessions_token_hash_key" ON "member_sessions"("token_hash");
CREATE INDEX "member_sessions_user_id_expires_at_idx" ON "member_sessions"("user_id", "expires_at");

CREATE TABLE "member_login_otps" (
  "id" TEXT PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "phone_hash" TEXT NOT NULL,
  "request_ip_hash" TEXT NOT NULL,
  "binding_hash" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "delivered_at" TIMESTAMPTZ(3),
  "consumed_at" TIMESTAMPTZ(3),
  "verified_at" TIMESTAMPTZ(3),
  "grant_hash" TEXT,
  "grant_expires_at" TIMESTAMPTZ(3),
  "enrollment_attempts" INTEGER NOT NULL DEFAULT 0,
  "target_user_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "member_login_otps_grant_hash_key" ON "member_login_otps"("grant_hash");
CREATE INDEX "member_login_otps_phone_hash_created_at_idx" ON "member_login_otps"("phone_hash", "created_at");
CREATE INDEX "member_login_otps_request_ip_hash_created_at_idx" ON "member_login_otps"("request_ip_hash", "created_at");
CREATE INDEX "member_login_otps_created_at_idx" ON "member_login_otps"("created_at");

CREATE TABLE "member_phone_recoveries" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "phone" TEXT NOT NULL,
  "approved_by_clerk_id" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "member_phone_recoveries_phone_expires_at_idx" ON "member_phone_recoveries"("phone", "expires_at");
CREATE INDEX "member_phone_recoveries_user_id_created_at_idx" ON "member_phone_recoveries"("user_id", "created_at");
