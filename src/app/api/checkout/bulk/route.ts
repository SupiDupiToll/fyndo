import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
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
    });

    if (products.length !== items.length) {
      return NextResponse.json({ error: "Einige Produkte wurden nicht gefunden." }, { status: 404 });
    }

    for (const p of products) {
      if (!p.isActive || p.posOnly) {
        return NextResponse.json({ error: `"${p.title}" ist nicht mehr verfuegbar.` }, { status: 400 });
      }
    }

    const description = products.map((p) => p.title).join(", ");

    // Alle Bestellungen in einem einzigen INSERT anlegen: Der Neon-HTTP-Treiber
    // auf Cloudflare Workers kann keine mehrstufigen Transaktionen ausführen,
    // ein einzelnes Statement ist aber von sich aus atomar.
    const now = new Date();
    const orders = await prisma.$queryRaw<{ id: string; amountCents: number }[]>`
      INSERT INTO "Order" (
        "id", "userId", "productId", "amountCents", "buyerName", "buyerEmail",
        "status", "createdAt", "updatedAt"
      )
      VALUES ${Prisma.join(
        items.map(
          (item) => Prisma.sql`(
            ${randomUUID()},
            ${user.id},
            ${item.productId},
            ${item.amountCents},
            ${user.displayName},
            ${user.email},
            'PENDING',
            ${now},
            ${now}
          )`,
        ),
      )}
      RETURNING "id", "amountCents"
    `;

    const totalCents = orders.reduce((sum, o) => sum + o.amountCents, 0);

    const orderIds = orders.map((o) => o.id).sort().join(",");
    const redirectUrl = `${configuredRedirectBase}?orderIds=${encodeURIComponent(orderIds)}`;
    const cancelUrl = configuredCancelUrl;

    const session = await createRbankPayment({
      amount: totalCents,
      description: `${description} - ${user.displayName}`,
      redirectUrl,
      cancelUrl,
      metadata: {
        bulkOrderIds: orderIds,
        userId: user.id,
      },
    });

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
