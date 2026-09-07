CREATE TABLE "ops_monthly_revenue_targets" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "month" DATE NOT NULL,
  "target_amount" DECIMAL(14,2) NOT NULL,
  "set_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ops_monthly_revenue_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ops_monthly_revenue_targets_branch_id_month_key"
  ON "ops_monthly_revenue_targets"("branch_id", "month");
CREATE INDEX "ops_monthly_revenue_targets_month_idx"
  ON "ops_monthly_revenue_targets"("month");

ALTER TABLE "ops_monthly_revenue_targets"
  ADD CONSTRAINT "ops_monthly_revenue_targets_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "ops_branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_monthly_revenue_targets"
  ADD CONSTRAINT "ops_monthly_revenue_targets_set_by_id_fkey"
  FOREIGN KEY ("set_by_id") REFERENCES "ops_staff"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
