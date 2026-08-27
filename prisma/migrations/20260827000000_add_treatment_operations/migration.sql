CREATE TYPE "OpsRole" AS ENUM ('SUPER_ADMIN', 'MANAGEMENT', 'FRONT_OFFICE', 'SUPERVISOR', 'THERAPIST', 'DOCTOR');
CREATE TYPE "OpsOrderStatus" AS ENUM ('DRAFT', 'CREATED', 'ASSIGNED', 'ON_PROCESS', 'WAITING_NEXT_ACTION', 'COMPLETED', 'VERIFIED', 'CANCELLED');
CREATE TYPE "OpsActionStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ON_PROCESS', 'COMPLETED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "OpsIncentiveType" AS ENUM ('FIXED', 'PERCENTAGE', 'POINTS', 'NONE');
CREATE TYPE "OpsIncentiveStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'VERIFIED', 'PAID', 'VOID');

CREATE TABLE "ops_branches" ("id" TEXT PRIMARY KEY, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "address" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_branches_code_key" ON "ops_branches"("code");

CREATE TABLE "ops_staff" ("id" TEXT PRIMARY KEY, "branch_id" TEXT, "username" TEXT NOT NULL, "password_hash" TEXT NOT NULL, "employee_id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT, "role" "OpsRole" NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "last_login_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_staff_username_key" ON "ops_staff"("username");
CREATE UNIQUE INDEX "ops_staff_employee_id_key" ON "ops_staff"("employee_id");
CREATE UNIQUE INDEX "ops_staff_email_key" ON "ops_staff"("email");
CREATE INDEX "ops_staff_branch_id_role_active_idx" ON "ops_staff"("branch_id", "role", "active");

CREATE TABLE "ops_sessions" ("id" TEXT PRIMARY KEY, "staff_id" TEXT NOT NULL, "token_hash" TEXT NOT NULL, "expires_at" TIMESTAMPTZ(3) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "ops_sessions_token_hash_key" ON "ops_sessions"("token_hash");
CREATE INDEX "ops_sessions_staff_id_expires_at_idx" ON "ops_sessions"("staff_id", "expires_at");

CREATE TABLE "ops_patients" ("id" TEXT PRIMARY KEY, "branch_id" TEXT NOT NULL, "patient_number" TEXT NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_patients_patient_number_key" ON "ops_patients"("patient_number");
CREATE INDEX "ops_patients_branch_id_name_idx" ON "ops_patients"("branch_id", "name");

CREATE TABLE "ops_doctors" ("id" TEXT PRIMARY KEY, "branch_id" TEXT NOT NULL, "staff_id" TEXT, "name" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_doctors_staff_id_key" ON "ops_doctors"("staff_id");
CREATE INDEX "ops_doctors_branch_id_active_idx" ON "ops_doctors"("branch_id", "active");

CREATE TABLE "ops_treatments" ("id" TEXT PRIMARY KEY, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "category" TEXT, "default_price" DECIMAL(14,2) NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_treatments_code_key" ON "ops_treatments"("code");

CREATE TABLE "ops_treatment_action_templates" ("id" TEXT PRIMARY KEY, "treatment_id" TEXT NOT NULL, "action_name" TEXT NOT NULL, "sequence_number" INTEGER NOT NULL, "is_required" BOOLEAN NOT NULL DEFAULT true, "estimated_duration_minutes" INTEGER, "incentive_type" "OpsIncentiveType" NOT NULL DEFAULT 'FIXED', "incentive_value" DECIMAL(14,2) NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_treatment_action_templates_treatment_id_sequence_number_key" ON "ops_treatment_action_templates"("treatment_id", "sequence_number");

CREATE TABLE "ops_treatment_orders" ("id" TEXT PRIMARY KEY, "order_number" TEXT NOT NULL, "branch_id" TEXT NOT NULL, "patient_id" TEXT NOT NULL, "doctor_id" TEXT, "treatment_id" TEXT NOT NULL, "visit_date" DATE NOT NULL, "original_price" DECIMAL(14,2) NOT NULL, "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0, "final_price" DECIMAL(14,2) NOT NULL, "status" "OpsOrderStatus" NOT NULL DEFAULT 'DRAFT', "patient_name_snapshot" TEXT NOT NULL, "treatment_name_snapshot" TEXT NOT NULL, "qr_token_hash" TEXT NOT NULL, "qr_token_expires_at" TIMESTAMPTZ(3), "qr_revoked_at" TIMESTAMPTZ(3), "internal_note" TEXT, "created_by_id" TEXT NOT NULL, "completed_at" TIMESTAMPTZ(3), "verified_at" TIMESTAMPTZ(3), "cancelled_at" TIMESTAMPTZ(3), "cancellation_reason" TEXT, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_treatment_orders_order_number_key" ON "ops_treatment_orders"("order_number");
CREATE UNIQUE INDEX "ops_treatment_orders_qr_token_hash_key" ON "ops_treatment_orders"("qr_token_hash");
CREATE INDEX "ops_treatment_orders_branch_id_visit_date_status_idx" ON "ops_treatment_orders"("branch_id", "visit_date", "status");
CREATE INDEX "ops_treatment_orders_patient_id_created_at_idx" ON "ops_treatment_orders"("patient_id", "created_at");

CREATE TABLE "ops_order_actions" ("id" TEXT PRIMARY KEY, "treatment_order_id" TEXT NOT NULL, "source_template_id" TEXT, "action_name_snapshot" TEXT NOT NULL, "sequence_number" INTEGER NOT NULL, "is_required" BOOLEAN NOT NULL, "status" "OpsActionStatus" NOT NULL DEFAULT 'PENDING', "assigned_therapist_id" TEXT, "performed_by_therapist_id" TEXT, "started_at" TIMESTAMPTZ(3), "completed_at" TIMESTAMPTZ(3), "duration_seconds" INTEGER, "incentive_type_snapshot" "OpsIncentiveType" NOT NULL, "incentive_value_snapshot" DECIMAL(14,2) NOT NULL, "calculated_incentive" DECIMAL(14,2), "completion_note" TEXT, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_order_actions_treatment_order_id_sequence_number_key" ON "ops_order_actions"("treatment_order_id", "sequence_number");
CREATE INDEX "ops_order_actions_assigned_therapist_id_status_idx" ON "ops_order_actions"("assigned_therapist_id", "status");

CREATE TABLE "ops_order_assignments" ("id" TEXT PRIMARY KEY, "treatment_order_id" TEXT NOT NULL, "order_action_id" TEXT, "therapist_id" TEXT NOT NULL, "assigned_by_id" TEXT NOT NULL, "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "unassigned_at" TIMESTAMPTZ(3), "reason" TEXT);
CREATE INDEX "ops_order_assignments_treatment_order_id_unassigned_at_idx" ON "ops_order_assignments"("treatment_order_id", "unassigned_at");

CREATE TABLE "ops_action_events" ("id" TEXT PRIMARY KEY, "treatment_order_id" TEXT NOT NULL, "order_action_id" TEXT, "event_type" TEXT NOT NULL, "actor_user_id" TEXT NOT NULL, "event_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata_json" JSONB);
CREATE INDEX "ops_action_events_treatment_order_id_event_at_idx" ON "ops_action_events"("treatment_order_id", "event_at");

CREATE TABLE "ops_incentive_ledger" ("id" TEXT PRIMARY KEY, "branch_id" TEXT NOT NULL, "therapist_id" TEXT NOT NULL, "treatment_order_id" TEXT NOT NULL, "order_action_id" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "status" "OpsIncentiveStatus" NOT NULL DEFAULT 'ELIGIBLE', "period" TEXT NOT NULL, "verified_by_id" TEXT, "verified_at" TIMESTAMPTZ(3), "paid_at" TIMESTAMPTZ(3), "adjustment_reason" TEXT, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_incentive_ledger_order_action_id_key" ON "ops_incentive_ledger"("order_action_id");
CREATE INDEX "ops_incentive_ledger_branch_id_period_status_idx" ON "ops_incentive_ledger"("branch_id", "period", "status");
CREATE INDEX "ops_incentive_ledger_therapist_id_period_idx" ON "ops_incentive_ledger"("therapist_id", "period");

CREATE TABLE "ops_incentive_periods" ("id" TEXT PRIMARY KEY, "branch_id" TEXT NOT NULL, "period_start" DATE NOT NULL, "period_end" DATE NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "locked_by_id" TEXT, "locked_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL);
CREATE UNIQUE INDEX "ops_incentive_periods_branch_id_period_start_period_end_key" ON "ops_incentive_periods"("branch_id", "period_start", "period_end");

CREATE TABLE "ops_audit_logs" ("id" TEXT PRIMARY KEY, "actor_user_id" TEXT NOT NULL, "branch_id" TEXT, "entity_type" TEXT NOT NULL, "entity_id" TEXT NOT NULL, "action" TEXT NOT NULL, "before_json" JSONB, "after_json" JSONB, "reason" TEXT, "ip_address" TEXT, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "ops_audit_logs_entity_type_entity_id_created_at_idx" ON "ops_audit_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "ops_audit_logs_branch_id_created_at_idx" ON "ops_audit_logs"("branch_id", "created_at");

ALTER TABLE "ops_staff" ADD CONSTRAINT "ops_staff_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "ops_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_sessions" ADD CONSTRAINT "ops_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "ops_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ops_patients" ADD CONSTRAINT "ops_patients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "ops_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_doctors" ADD CONSTRAINT "ops_doctors_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "ops_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_treatment_action_templates" ADD CONSTRAINT "ops_treatment_action_templates_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "ops_treatments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_treatment_orders" ADD CONSTRAINT "ops_treatment_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "ops_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_treatment_orders" ADD CONSTRAINT "ops_treatment_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "ops_patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_treatment_orders" ADD CONSTRAINT "ops_treatment_orders_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "ops_doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_treatment_orders" ADD CONSTRAINT "ops_treatment_orders_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "ops_treatments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_treatment_orders" ADD CONSTRAINT "ops_treatment_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_order_actions" ADD CONSTRAINT "ops_order_actions_treatment_order_id_fkey" FOREIGN KEY ("treatment_order_id") REFERENCES "ops_treatment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_order_actions" ADD CONSTRAINT "ops_order_actions_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "ops_treatment_action_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ops_order_actions" ADD CONSTRAINT "ops_order_actions_assigned_therapist_id_fkey" FOREIGN KEY ("assigned_therapist_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_order_actions" ADD CONSTRAINT "ops_order_actions_performed_by_therapist_id_fkey" FOREIGN KEY ("performed_by_therapist_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_order_assignments" ADD CONSTRAINT "ops_order_assignments_treatment_order_id_fkey" FOREIGN KEY ("treatment_order_id") REFERENCES "ops_treatment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_order_assignments" ADD CONSTRAINT "ops_order_assignments_order_action_id_fkey" FOREIGN KEY ("order_action_id") REFERENCES "ops_order_actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_order_assignments" ADD CONSTRAINT "ops_order_assignments_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_order_assignments" ADD CONSTRAINT "ops_order_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_action_events" ADD CONSTRAINT "ops_action_events_treatment_order_id_fkey" FOREIGN KEY ("treatment_order_id") REFERENCES "ops_treatment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_action_events" ADD CONSTRAINT "ops_action_events_order_action_id_fkey" FOREIGN KEY ("order_action_id") REFERENCES "ops_order_actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_action_events" ADD CONSTRAINT "ops_action_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_incentive_ledger" ADD CONSTRAINT "ops_incentive_ledger_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "ops_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_incentive_ledger" ADD CONSTRAINT "ops_incentive_ledger_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_incentive_ledger" ADD CONSTRAINT "ops_incentive_ledger_treatment_order_id_fkey" FOREIGN KEY ("treatment_order_id") REFERENCES "ops_treatment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_incentive_ledger" ADD CONSTRAINT "ops_incentive_ledger_order_action_id_fkey" FOREIGN KEY ("order_action_id") REFERENCES "ops_order_actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_incentive_ledger" ADD CONSTRAINT "ops_incentive_ledger_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_incentive_periods" ADD CONSTRAINT "ops_incentive_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "ops_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_incentive_periods" ADD CONSTRAINT "ops_incentive_periods_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_audit_logs" ADD CONSTRAINT "ops_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "ops_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ops_audit_logs" ADD CONSTRAINT "ops_audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "ops_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
