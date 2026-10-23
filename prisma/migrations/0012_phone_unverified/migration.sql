-- Mobile numbers are no longer verified at sign-up, so a typed number must not
-- block its real owner: only a verified number is unique (delivery partners).
DROP INDEX IF EXISTS "User_phone_key";
CREATE INDEX "User_phone_idx" ON "User"("phone");
CREATE UNIQUE INDEX "User_phone_verified_key" ON "User"("phone") WHERE "phoneVerifiedAt" IS NOT NULL;
