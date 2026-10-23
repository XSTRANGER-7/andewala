-- Delivery partners are picked by the email of their account (verified at
-- sign-up or by Google). The mobile number is only a contact for customers.
ALTER TABLE "Rider" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "Rider_email_key" ON "Rider"("email");
ALTER TABLE "Rider" ALTER COLUMN "phone" DROP NOT NULL;
DROP INDEX IF EXISTS "Rider_phone_key";

-- Existing riders: take the email of the account that uses their number.
UPDATE "Rider" r SET "email" = u."email"
FROM "User" u
WHERE u."phone" = r."phone" AND u."email" IS NOT NULL AND r."email" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Rider" r2 WHERE r2."email" = u."email");
