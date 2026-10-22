-- CreateTable
CREATE TABLE "StoreOnboardingProgress" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "step1EstablishmentDone" BOOLEAN NOT NULL DEFAULT false,
    "step2PaymentDone" BOOLEAN NOT NULL DEFAULT false,
    "step3HoursDone" BOOLEAN NOT NULL DEFAULT false,
    "step4DeliveryAreaDone" BOOLEAN NOT NULL DEFAULT false,
    "step5BotDone" BOOLEAN NOT NULL DEFAULT false,
    "step6DeliveryTimeDone" BOOLEAN NOT NULL DEFAULT false,
    "step7SalaoStructureDone" BOOLEAN NOT NULL DEFAULT false,
    "step8ReviewDone" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StoreOnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreOnboardingProgress_storeId_key" ON "StoreOnboardingProgress"("storeId");

-- AddForeignKey
ALTER TABLE "StoreOnboardingProgress" ADD CONSTRAINT "StoreOnboardingProgress_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
