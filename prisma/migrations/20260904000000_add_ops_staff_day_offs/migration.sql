CREATE TABLE "ops_staff_day_offs" (
  "id" TEXT PRIMARY KEY,
  "staff_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "note" VARCHAR(240),
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);

CREATE UNIQUE INDEX "ops_staff_day_offs_staff_id_date_key"
  ON "ops_staff_day_offs"("staff_id", "date");
CREATE INDEX "ops_staff_day_offs_date_idx"
  ON "ops_staff_day_offs"("date");

ALTER TABLE "ops_staff_day_offs"
  ADD CONSTRAINT "ops_staff_day_offs_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "ops_staff"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_staff_day_offs"
  ADD CONSTRAINT "ops_staff_day_offs_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "ops_staff"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
