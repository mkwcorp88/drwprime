-- Restore the canonical Silver/Gold/Platinum membership policy.
ALTER TABLE "users" ALTER COLUMN "loyalty_level" SET DEFAULT 'Silver';

UPDATE "users"
SET "loyalty_level" = CASE
  WHEN COALESCE("total_spending", 0) >= 10000000 THEN 'Platinum'
  WHEN COALESCE("total_spending", 0) >= 5000000 THEN 'Gold'
  ELSE 'Silver'
END
WHERE "loyalty_level" IS DISTINCT FROM CASE
  WHEN COALESCE("total_spending", 0) >= 10000000 THEN 'Platinum'
  WHEN COALESCE("total_spending", 0) >= 5000000 THEN 'Gold'
  ELSE 'Silver'
END;
