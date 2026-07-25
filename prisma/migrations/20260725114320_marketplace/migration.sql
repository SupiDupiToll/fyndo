-- Drop old tables if they exist (pre-migration data)
DROP TABLE IF EXISTS "Order" CASCADE;
DROP TABLE IF EXISTS "Product" CASCADE;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'SELLER', 'USER');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PRODUCT', 'VOUCHER');

-- CreateEnum
CREATE TYPE "VoucherMode" AS ENUM ('RANGE', 'FIXED');

-- CreateEnum
CREATE TYPE "VoucherDiscountType" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ThirdPartyOrderStatus" AS ENUM ('REQUESTED', 'QUOTED', 'ORDERED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "stackUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "sellerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'PRODUCT',
    "voucherMode" "VoucherMode",
    "voucherMinCents" INTEGER,
    "voucherMaxCents" INTEGER,
    "voucherStepCents" INTEGER DEFAULT 100,
    "voucherAmounts" JSONB,
    "voucherDiscountType" "VoucherDiscountType" DEFAULT 'FIXED',
    "voucherDiscountValue" DOUBLE PRECISION DEFAULT 10,
    "voucherNoticeText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "voucherFaceValueCents" INTEGER,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "giftCardLink" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentToken" TEXT,
    "notificationSentAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThirdPartyOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopHost" TEXT NOT NULL,
    "shopFaviconUrl" TEXT,
    "customerNote" TEXT,
    "amountCents" INTEGER,
    "paymentToken" TEXT,
    "adminNote" TEXT,
    "status" "ThirdPartyOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "notificationSentAt" TIMESTAMP(3),
    "quotedAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThirdPartyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_stackUserId_key" ON "User"("stackUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentToken_key" ON "Order"("paymentToken");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdPartyOrder_paymentToken_key" ON "ThirdPartyOrder"("paymentToken");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyOrder" ADD CONSTRAINT "ThirdPartyOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
