import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { POS_PAYMENT_METHODS } from "@/lib/pos";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { vendor?: string; items?: { productId: string; qty?: number }[] };
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
    }))
    .filter((i) => i.productId && i.qty > 0)
    .reduce<{ productId: string; qty: number }[]>((acc, i) => {
      const existing = acc.find((x) => x.productId === i.productId);
      if (existing) existing.qty += i.qty;
      else acc.push({ productId: i.productId, qty: i.qty });
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

  if (products.length !== items.length) {
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

  const posGroupId = randomUUID();
  const posConfirmToken = randomUUID();
  const totalCents = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return sum + product.price * item.qty;
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
      return {
        userId: null,
        productId: product.id,
        amountCents: product.price * item.qty,
        buyerName: "POS",
        buyerEmail: vendor.email,
        status: "PENDING",
        paymentMethod: null,
        posGroupId,
        posConfirmToken,
        posOrderNumber,
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
