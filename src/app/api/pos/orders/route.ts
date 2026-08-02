import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { POS_PAYMENT_METHODS } from "@/lib/pos";
import { findVariant, parseVariants } from "@/lib/product-variants";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { vendor?: string; items?: { productId: string; qty?: number; variantId?: string | null }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabedaten." }, { status: 400 });
  }

  const vendorName = String(body.vendor ?? "").trim();
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!vendorName) {
    return NextResponse.json({ error: "Verkäufer fehlt." }, { status: 400 });
  }

  const items = rawItems
    .map((i) => ({
      productId: String(i.productId ?? ""),
      qty: Number(i.qty) || 0,
      variantId: i.variantId ? String(i.variantId) : null,
    }))
    .filter((i) => i.productId && i.qty > 0)
    .reduce<{ productId: string; qty: number; variantId: string | null }[]>((acc, i) => {
      const existing = acc.find((x) => x.productId === i.productId && x.variantId === i.variantId);
      if (existing) existing.qty += i.qty;
      else acc.push({ productId: i.productId, qty: i.qty, variantId: i.variantId });
      return acc;
    }, []);

  if (items.length === 0) {
    return NextResponse.json({ error: "Keine Artikel im Warenkorb." }, { status: 400 });
  }

  const vendor = await prisma.user.findFirst({
    where: {
      OR: [{ sellerName: vendorName }, { displayName: vendorName }],
    },
  });

  if (!vendor) {
    return NextResponse.json({ error: "Verkäufer nicht gefunden." }, { status: 404 });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });

  const uniqueProductIds = new Set(items.map((i) => i.productId));
  if (products.length !== uniqueProductIds.size) {
    return NextResponse.json({ error: "Einige Produkte wurden nicht gefunden." }, { status: 404 });
  }

  for (const product of products) {
    if (
      !product.isActive ||
      product.kind !== "PRODUCT" ||
      product.posVisible !== true ||
      product.sellerId !== vendor.id
    ) {
      return NextResponse.json(
        { error: `"${product.title}" ist nicht mehr verfügbar.` },
        { status: 400 },
      );
    }
  }

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    const variant = findVariant(product, item.variantId);
    if (item.variantId && !variant) {
      return NextResponse.json(
        { error: `"${product.title}": Variante nicht gefunden.` },
        { status: 400 },
      );
    }
    if (!item.variantId && parseVariants(product.variants)?.length) {
      return NextResponse.json(
        { error: `"${product.title}": Bitte eine Variante wählen.` },
        { status: 400 },
      );
    }
  }

  const posGroupId = randomUUID();
  const posConfirmToken = randomUUID();
  const totalCents = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const variant = findVariant(product, item.variantId);
    return sum + (variant ? variant.priceCents : product.price) * item.qty;
  }, 0);

  const lastOrder = await prisma.order.findFirst({
    where: { product: { sellerId: vendor.id }, posOrderNumber: { not: null } },
    orderBy: { posOrderNumber: "desc" },
    select: { posOrderNumber: true },
  });
  const posOrderNumber = (lastOrder?.posOrderNumber ?? 0) + 1;

  await prisma.order.createMany({
    data: items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const variant = findVariant(product, item.variantId);
      return {
        userId: null,
        productId: product.id,
        amountCents: (variant ? variant.priceCents : product.price) * item.qty,
        quantity: item.qty,
        buyerName: "POS",
        buyerEmail: vendor.email,
        status: "PENDING",
        paymentMethod: null,
        posGroupId,
        posConfirmToken,
        posOrderNumber,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
      };
    }),
  });

  return NextResponse.json({
    posGroupId,
    posConfirmToken,
    posOrderNumber,
    totalCents,
    itemCount: items.reduce((sum, i) => sum + i.qty, 0),
  });
}

export function OPTIONS() {
  return NextResponse.json({ methods: POS_PAYMENT_METHODS });
}
