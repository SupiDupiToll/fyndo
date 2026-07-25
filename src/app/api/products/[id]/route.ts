import { NextRequest, NextResponse } from "next/server";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { seller: { select: { sellerName: true, displayName: true } } },
  });
  if (!product) {
    return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireSellerOrSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
  }

  if (product.sellerId !== user.id && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, imageUrl, price, kind, voucherMode, voucherMinCents, voucherMaxCents, voucherStepCents, voucherAmounts, voucherDiscountType, voucherDiscountValue, voucherNoticeText, isActive } = body;

  const canCreateVouchers = user.role === "SUPER_ADMIN" || user.sellerName === "RundiShop";
  const finalKind = kind === "VOUCHER" && canCreateVouchers ? "VOUCHER" : "PRODUCT";

  const updateData: Record<string, unknown> = {};

  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
  if (price !== undefined) updateData.price = Math.round(parseFloat(price) * 100);
  if (isActive !== undefined) updateData.isActive = isActive;

  if (finalKind === "VOUCHER") {
    updateData.kind = "VOUCHER";
    updateData.voucherMode = voucherMode || null;
    updateData.voucherMinCents = voucherMinCents ? parseInt(voucherMinCents) : null;
    updateData.voucherMaxCents = voucherMaxCents ? parseInt(voucherMaxCents) : null;
    updateData.voucherStepCents = voucherStepCents ? parseInt(voucherStepCents) : 100;
    updateData.voucherAmounts = voucherAmounts ? JSON.parse(voucherAmounts) : undefined;
    updateData.voucherDiscountType = voucherDiscountType || "FIXED";
    updateData.voucherDiscountValue = voucherDiscountValue ? parseFloat(voucherDiscountValue) : 10;
    updateData.voucherNoticeText = voucherNoticeText || null;
  } else {
    updateData.kind = "PRODUCT";
    updateData.voucherMode = null;
    updateData.voucherMinCents = null;
    updateData.voucherMaxCents = null;
    updateData.voucherStepCents = null;
    updateData.voucherAmounts = undefined;
    updateData.voucherDiscountType = null;
    updateData.voucherDiscountValue = null;
    updateData.voucherNoticeText = null;
  }

  const updated = await prisma.product.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireSellerOrSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
  }

  if (product.sellerId !== user.id && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  await prisma.order.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
