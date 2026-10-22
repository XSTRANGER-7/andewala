-- Customer passwords (scrypt hashes) for email + password login.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
