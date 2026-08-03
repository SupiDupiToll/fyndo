-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "posCardId" TEXT;

-- CreateTable
CREATE TABLE "PosNumberCard" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosNumberCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosNumberCard_sellerId_batchId_idx" ON "PosNumberCard"("sellerId", "batchId");

-- CreateIndex
CREATE INDEX "PosNumberCard_sellerId_used_idx" ON "PosNumberCard"("sellerId", "used");

-- CreateIndex
CREATE INDEX "PosNumberCard_batchId_idx" ON "PosNumberCard"("batchId");
