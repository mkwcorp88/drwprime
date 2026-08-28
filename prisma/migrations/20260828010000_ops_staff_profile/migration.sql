ALTER TABLE "ops_staff"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "avatar_key" TEXT;

CREATE UNIQUE INDEX "ops_staff_phone_key" ON "ops_staff"("phone");
CREATE UNIQUE INDEX "ops_staff_avatar_key_key" ON "ops_staff"("avatar_key");
