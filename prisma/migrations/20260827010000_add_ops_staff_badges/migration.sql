ALTER TABLE "ops_staff"
  ADD COLUMN "badge_token_hash" TEXT,
  ADD COLUMN "badge_issued_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "ops_staff_badge_token_hash_key" ON "ops_staff"("badge_token_hash");
