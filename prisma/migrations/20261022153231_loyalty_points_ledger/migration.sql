-- CreateTable
CREATE TABLE "LoyaltyPointsLedger" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyPointsLedger_storeId_customerId_idx" ON "LoyaltyPointsLedger"("storeId", "customerId");

-- AddForeignKey
ALTER TABLE "LoyaltyPointsLedger" ADD CONSTRAINT "LoyaltyPointsLedger_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
