ALTER TABLE "ops_staff"
  ADD COLUMN "badge_token" TEXT;

CREATE UNIQUE INDEX "ops_staff_badge_token_key" ON "ops_staff"("badge_token");
