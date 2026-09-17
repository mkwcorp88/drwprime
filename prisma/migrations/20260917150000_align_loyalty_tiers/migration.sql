-- Keep persisted levels aligned with the canonical Bronze/Silver/Gold/Platinum policy.
LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "users" ALTER COLUMN "loyalty_level" SET DEFAULT 'Bronze';

UPDATE "users"
SET "loyalty_level" = CASE
  WHEN "total_spending" >= 10000000 THEN 'Platinum'
  WHEN "total_spending" >= 5000000 THEN 'Gold'
  WHEN "total_spending" >= 1000000 THEN 'Silver'
  ELSE 'Bronze'
END;
