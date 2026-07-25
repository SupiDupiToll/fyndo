import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAppUrl, getRbankConfig } from "@/lib/env";
import { prisma } from "@/lib/db";
import { createRbankPayment } from "@/lib/rbank";
import { isDemoUser } from "@/lib/demo";

export async function POST(request: NextRequest) {
  const appUrl = getAppUrl();
  const configuredRedirectBase = `${appUrl}/checkout/complete`;
  const configuredCancelUrl = `${appUrl}?cancelled=1`;

  try {
    const user = await requireUser();

    if (isDemoUser(user)) {
      return NextResponse.json({ error: "Demo-Nutzer duerfen nichts bestellen." }, { status: 403 });
    }

    const body = (await request.json()) as { items: { productId: string; amountCents: number }[] };
    const items = body.items ?? [];

    if (items.length === 0) {
      return NextResponse.json({ error: "Keine Artikel zum Bezahlen." }, { status: 400 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      include: { seller: true },
    });

    if (products.length !== items.length) {
      return NextResponse.json({ error: "Einige Produkte wurden nicht gefunden." }, { status: 404 });
    }

    for (const p of products) {
      if (!p.isActive) {
        return NextResponse.json({ error: `"${p.title}" ist nicht mehr verfuegbar.` }, { status: 400 });
      }
    }

    const sellerIds = new Set(products.map((p) => p.sellerId));
    if (sellerIds.size > 1) {
      return NextResponse.json(
        { error: "Artikel von verschiedenen Verkäufern müssen separat bezahlt werden." },
        { status: 400 },
      );
    }

    const seller = products[0].seller;
    const description = products.map((p) => p.title).join(", ");

    const orders = await prisma.$transaction(
      items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        return prisma.order.create({
          data: {
            userId: user.id,
            productId: item.productId,
            amountCents: item.amountCents,
            buyerName: user.displayName,
            buyerEmail: user.email,
            status: "PENDING",
          },
        });
      }),
    );

    const totalCents = orders.reduce((sum, o) => sum + o.amountCents, 0);

    const orderIds = orders.map((o) => o.id).sort().join(",");
    const redirectUrl = `${configuredRedirectBase}?orderIds=${encodeURIComponent(orderIds)}`;
    const cancelUrl = configuredCancelUrl;

    const sellerConfig = seller.rbankMerchantId && seller.rbankMerchantSecret
      ? {
          apiUrl: seller.rbankApiUrl ?? getRbankConfig().apiUrl,
          merchantId: seller.rbankMerchantId,
          merchantSecret: seller.rbankMerchantSecret,
        }
      : undefined;

    const session = await createRbankPayment(
      {
        amount: totalCents,
        description: `${description} - ${user.displayName}`,
        redirectUrl,
        cancelUrl,
        metadata: {
          bulkOrderIds: orderIds,
          userId: user.id,
        },
      },
      sellerConfig,
    );

    for (const order of orders) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentToken: `${session.token}__${order.id}` },
      });
    }

    return NextResponse.json({ paymentUrl: session.paymentUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 });
    }
    console.error("Bulk checkout failed:", error);
    return NextResponse.json({ error: "Checkout konnte nicht gestartet werden." }, { status: 500 });
  }
}
