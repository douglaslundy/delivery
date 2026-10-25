-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RecoveryMessage" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecoveryMessage_storeId_customerId_sentAt_idx" ON "RecoveryMessage"("storeId", "customerId", "sentAt");
