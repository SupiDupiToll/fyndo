-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "variantId" TEXT,
ADD COLUMN     "variantName" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "variants" JSONB DEFAULT '[]';
