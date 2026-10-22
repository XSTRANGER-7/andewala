-- Delivery areas drawn on the map by the admin.
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "radiusM" INTEGER,
    "pointsJson" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT NOT NULL DEFAULT '#2f7d5b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "deliveryZone" TEXT;

-- Keep it off Supabase's public API, like every other table (see 0002).
ALTER TABLE "DeliveryZone" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DeliveryZone" FROM anon, authenticated;
