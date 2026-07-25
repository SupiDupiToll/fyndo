import { NextRequest, NextResponse } from "next/server";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { seller: { select: { sellerName: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  try {
    await requireSellerOrSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const user = await requireSellerOrSuperAdmin();
  const body = await request.json();
  const { title, description, imageUrl, price, kind, voucherMode, voucherMinCents, voucherMaxCents, voucherStepCents, voucherAmounts, voucherDiscountType, voucherDiscountValue, voucherNoticeText } = body;

  if (!title || !description || !price === undefined) {
    return NextResponse.json(
      { error: "Titel, Beschreibung und Preis sind erforderlich" },
      { status: 400 }
    );
  }

  const canCreateVouchers = user.role === "SUPER_ADMIN" || user.sellerName === "RundiShop";
  const finalKind = kind === "VOUCHER" && canCreateVouchers ? "VOUCHER" : "PRODUCT";

  const priceInCents = Math.round(parseFloat(price) * 100);

  const product = await prisma.product.create({
    data: {
      sellerId: user.id,
      title,
      description,
      imageUrl: imageUrl || null,
      price: priceInCents,
      kind: finalKind,
      voucherMode: finalKind === "VOUCHER" ? voucherMode : null,
      voucherMinCents: finalKind === "VOUCHER" ? (voucherMinCents ? parseInt(voucherMinCents) : null) : null,
      voucherMaxCents: finalKind === "VOUCHER" ? (voucherMaxCents ? parseInt(voucherMaxCents) : null) : null,
      voucherStepCents: finalKind === "VOUCHER" ? (voucherStepCents ? parseInt(voucherStepCents) : 100) : null,
      voucherAmounts: finalKind === "VOUCHER" && voucherAmounts ? JSON.parse(voucherAmounts) : undefined,
      voucherDiscountType: finalKind === "VOUCHER" ? voucherDiscountType : null,
      voucherDiscountValue: finalKind === "VOUCHER" ? (voucherDiscountValue ? parseFloat(voucherDiscountValue) : 10) : null,
      voucherNoticeText: finalKind === "VOUCHER" ? voucherNoticeText : null,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
