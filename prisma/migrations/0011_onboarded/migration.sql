-- When the customer finished the one-time "Finish your account" step.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Accounts that already have a delivery address are existing customers.
UPDATE "User" SET "onboardedAt" = "createdAt" WHERE EXISTS (SELECT 1 FROM "Address" a WHERE a."userId" = "User"."id");
