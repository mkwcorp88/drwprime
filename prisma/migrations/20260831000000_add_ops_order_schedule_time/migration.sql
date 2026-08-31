ALTER TABLE "ops_treatment_orders" ADD COLUMN "scheduled_at" TIMESTAMPTZ(3);
CREATE INDEX "ops_treatment_orders_branch_id_scheduled_at_idx" ON "ops_treatment_orders"("branch_id", "scheduled_at");
