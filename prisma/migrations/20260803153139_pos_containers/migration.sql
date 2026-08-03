-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "posContainerId" TEXT,
ADD COLUMN     "posContainerName" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isContainer" BOOLEAN NOT NULL DEFAULT false;
