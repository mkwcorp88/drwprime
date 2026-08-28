ALTER TABLE "ops_treatment_action_templates"
  ADD COLUMN "required_role" "OpsRole";

ALTER TABLE "ops_order_actions"
  ADD COLUMN "required_role_snapshot" "OpsRole";
