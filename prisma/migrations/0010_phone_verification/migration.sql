-- Codes sent to verify a mobile number for a logged-in account.
ALTER TABLE "OtpCode" ADD COLUMN "userId" TEXT;
CREATE INDEX "OtpCode_userId_createdAt_idx" ON "OtpCode"("userId", "createdAt");

-- Sign in with Google.
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
