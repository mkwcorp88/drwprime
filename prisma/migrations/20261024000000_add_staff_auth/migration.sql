CREATE TABLE "staff_accounts" (
    "id" TEXT NOT NULL,
    "legacy_clerk_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "google_sub" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cms_access" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_accounts_legacy_clerk_id_key" ON "staff_accounts"("legacy_clerk_id");
CREATE UNIQUE INDEX "staff_accounts_email_key" ON "staff_accounts"("email");
CREATE UNIQUE INDEX "staff_accounts_phone_key" ON "staff_accounts"("phone");
CREATE UNIQUE INDEX "staff_accounts_google_sub_key" ON "staff_accounts"("google_sub");

CREATE TABLE "staff_sessions" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "staff_sessions"("token_hash");
CREATE INDEX "staff_sessions_staff_id_expires_at_idx" ON "staff_sessions"("staff_id", "expires_at");
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "staff_login_otps" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "phone" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "request_ip_hash" TEXT NOT NULL,
    "binding_hash" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "delivered_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_login_otps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "staff_login_otps_phone_hash_created_at_idx" ON "staff_login_otps"("phone_hash", "created_at");
CREATE INDEX "staff_login_otps_request_ip_hash_created_at_idx" ON "staff_login_otps"("request_ip_hash", "created_at");
ALTER TABLE "staff_login_otps" ADD CONSTRAINT "staff_login_otps_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
