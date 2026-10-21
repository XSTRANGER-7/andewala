-- Store hours and manual open/closed/out-of-stock switches.
ALTER TABLE "StoreConfig"
  ADD COLUMN "openTime" TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN "storeMode" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "outOfStock" BOOLEAN NOT NULL DEFAULT false;
-- A store that was paused stays closed.
UPDATE "StoreConfig" SET "storeMode" = 'closed' WHERE "salesPaused" = true;
