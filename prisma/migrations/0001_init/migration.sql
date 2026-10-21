-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "StoreConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "storeName" TEXT NOT NULL DEFAULT 'AndeWala',
    "areaName" TEXT NOT NULL DEFAULT 'our delivery zone',
    "supportPhone" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL DEFAULT 210,
    "priceUpdatedAt" TIMESTAMP(3),
    "scheduledPrice" INTEGER,
    "scheduledDate" TEXT,
    "costFarm" DOUBLE PRECISION NOT NULL DEFAULT 180,
    "costInbound" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "costPackaging" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "costPayment" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "costDelivery" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "targetContribution" DOUBLE PRECISION NOT NULL DEFAULT 13,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "salesPaused" BOOLEAN NOT NULL DEFAULT false,
    "cutoff" TEXT NOT NULL DEFAULT '17:00',
    "deadline" TEXT NOT NULL DEFAULT '21:00',
    "daysAhead" INTEGER NOT NULL DEFAULT 3,
    "slotsJson" TEXT NOT NULL DEFAULT '[]',
    "deliveryFee" INTEGER NOT NULL DEFAULT 15,
    "freeDeliveryFrom" INTEGER NOT NULL DEFAULT 2,
    "maxTrays" INTEGER NOT NULL DEFAULT 10,
    "pincodesJson" TEXT NOT NULL DEFAULT '[]',
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "upiOnDelivery" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "trays" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "productCost" DOUBLE PRECISION NOT NULL,
    "deliveryCost" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT NOT NULL DEFAULT '',
    "pincode" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "payment" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'placed',
    "historyJson" TEXT NOT NULL DEFAULT '[]',
    "issueText" TEXT,
    "issueAt" TIMESTAMP(3),
    "issueResolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "email" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Home',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT NOT NULL DEFAULT '',
    "pincode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_date_slotId_idx" ON "Order"("date", "slotId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_phone_idx" ON "Order"("phone");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "OtpCode_target_createdAt_idx" ON "OtpCode"("target", "createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_ip_createdAt_idx" ON "OtpCode"("ip", "createdAt");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

