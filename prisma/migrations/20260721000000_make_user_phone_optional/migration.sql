-- Bring legacy camelCase user columns forward to the schema used by the app.
-- Every rename is conditional so databases that already use snake_case are unchanged.
DO $$
DECLARE
  legacy_column TEXT;
  current_column TEXT;
BEGIN
  FOR legacy_column, current_column IN
    SELECT * FROM (VALUES
      ('clerkUserId', 'clerk_user_id'),
      ('firstName', 'first_name'),
      ('lastName', 'last_name'),
      ('dateOfBirth', 'date_of_birth'),
      ('postalCode', 'postal_code'),
      ('profileCompletedAt', 'profile_completed_at'),
      ('qrToken', 'qr_token'),
      ('affiliateCode', 'affiliate_code'),
      ('isTeamLeader', 'is_team_leader'),
      ('affiliateCodeUpdatedAt', 'affiliate_code_updated_at'),
      ('affiliateCodeHistory', 'affiliate_code_history'),
      ('isAdmin', 'is_admin'),
      ('loyaltyPoints', 'loyalty_points'),
      ('loyaltyLevel', 'loyalty_level'),
      ('totalReferrals', 'total_referrals'),
      ('totalEarnings', 'total_earnings'),
      ('createdAt', 'created_at'),
      ('updatedAt', 'updated_at')
    ) AS columns(legacy_column, current_column)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'users'
        AND column_name = legacy_column
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'users'
        AND column_name = current_column
    ) THEN
      EXECUTE format('ALTER TABLE "users" RENAME COLUMN %I TO %I', legacy_column, current_column);
    END IF;
  END LOOP;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "has_account" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "member_since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "total_spending" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_transaction_at" TIMESTAMP(3);

UPDATE "users"
SET "first_name" = 'Member'
WHERE "first_name" IS NULL OR BTRIM("first_name") = '';

UPDATE "users"
SET "has_account" = true
WHERE "clerk_user_id" IS NOT NULL;

ALTER TABLE "users"
  ALTER COLUMN "clerk_user_id" DROP NOT NULL,
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "first_name" SET NOT NULL,
  ALTER COLUMN "affiliate_code" DROP NOT NULL,
  ALTER COLUMN "phone" DROP NOT NULL;
