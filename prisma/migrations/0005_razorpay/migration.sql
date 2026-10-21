-- Online payment through Razorpay.
ALTER TABLE "Order" ADD COLUMN "razorpayOrderId" TEXT, ADD COLUMN "razorpayPaymentId" TEXT;
ALTER TABLE "StoreConfig" ADD COLUMN "onlineEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "orderId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentAttempt_razorpayOrderId_key" ON "PaymentAttempt"("razorpayOrderId");
CREATE INDEX "PaymentAttempt_userId_idx" ON "PaymentAttempt"("userId");

-- Keep the new table off Supabase's public API, like every other table (see 0002).
ALTER TABLE "PaymentAttempt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PaymentAttempt" FROM anon, authenticated;
