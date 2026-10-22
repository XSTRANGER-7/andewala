-- Delivery partners and their deliveries.
CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Rider_phone_key" ON "Rider"("phone");

ALTER TABLE "Order"
  ADD COLUMN "riderId" TEXT,
  ADD COLUMN "deliveryCode" TEXT,
  ADD COLUMN "deliveryCodeTries" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deliveredAt" TIMESTAMP(3);
CREATE INDEX "Order_riderId_idx" ON "Order"("riderId");

-- Keep it off Supabase's public API, like every other table (see 0002).
ALTER TABLE "Rider" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Rider" FROM anon, authenticated;
