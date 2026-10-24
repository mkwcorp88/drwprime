CREATE TABLE "member_google_accounts" (
    "google_sub" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pending_referral_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_google_accounts_pkey" PRIMARY KEY ("google_sub")
);

CREATE UNIQUE INDEX "member_google_accounts_user_id_key" ON "member_google_accounts"("user_id");

ALTER TABLE "member_google_accounts"
ADD CONSTRAINT "member_google_accounts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "member_login_otps_phone_created_at_idx" ON "member_login_otps"("phone", "created_at");
ALTER TABLE "member_login_otps" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'login';
