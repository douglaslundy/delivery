-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "estimatedDeliveryMinutes" INTEGER,
ADD COLUMN     "hasPdv" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tableCount" INTEGER;
