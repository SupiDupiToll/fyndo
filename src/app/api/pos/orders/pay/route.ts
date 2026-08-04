import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppUrl } from "@/lib/env";
import { buildRbankEmbedCheckoutUrl, createRbankPayment } from "@/lib/rbank";
import { buildTippieUrl, POS_MIN_DIGITAL_PAYMENT_CENTS, POS_PAYMENT_METHODS, type PosPaymentMethod } from "@/lib/pos";
import { formatEuro } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { posGroupId?: string; posConfirmToken?: string; method?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabedaten." }, { status: 400 });
  }

  const posGroupId = String(body.posGroupId ?? "");
  const posConfirmToken = String(body.posConfirmToken ?? "");
  const method = String(body.method ?? "").toUpperCase() as PosPaymentMethod;

  if (!posGroupId || !posConfirmToken) {
    return NextResponse.json({ error: "Bestellung fehlt." }, { status: 400 });
  }
  if (!POS_PAYMENT_METHODS.includes(method)) {
    return NextResponse.json({ error: "Unbekannte Zahlungsart." }, { status: 400 });
  }
  if (method === "GUTSCHEIN") {
    return NextResponse.json(
      { error: "Gutschein wird direkt beim Auschecken eingelöst." },
      { status: 400 },
    );
  }

  const orders = await prisma.order.findMany({
    where: { posGroupId, posConfirmToken, status: "PENDING" },
    include: { product: { include: { seller: { select: { id: true, sellerName: true, displayName: true, email: true } } } } },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "Bestellung nicht gefunden oder bereits abgeschlossen." }, { status: 404 });
  }

  const totalCents = orders.reduce((sum, o) => sum + o.amountCents, 0);
  const seller = orders[0].product.seller;
  const productNames = orders.map((o) => o.product.title).join(", ");

  if ((method === "TIPPIE" || method === "TERMINAL") && totalCents < POS_MIN_DIGITAL_PAYMENT_CENTS) {
    return NextResponse.json(
      { error: `Für diese Zahlungsart sind mindestens ${formatEuro(POS_MIN_DIGITAL_PAYMENT_CENTS)} nötig.` },
      { status: 400 },
    );
  }

  if (method === "RBANK") {
    const appUrl = getAppUrl();
    const redirectUrl = `${appUrl}/pos/${encodeURIComponent(seller.sellerName ?? seller.displayName)}?payed=1`;
    const cancelUrl = `${appUrl}/pos/${encodeURIComponent(seller.sellerName ?? seller.displayName)}?cancelled=1`;

    const session = await createRbankPayment({
      amount: totalCents,
      description: `${productNames} – POS ${seller.sellerName ?? seller.displayName}`,
      redirectUrl,
      cancelUrl,
      metadata: {
        posGroupId,
        sellerId: seller.id,
        pos: "1",
      },
    });

    for (const order of orders) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentToken: `${session.token}__${order.id}`, paymentMethod: "RBANK" },
      });
    }

    return NextResponse.json({
      method,
      paymentUrl: buildRbankEmbedCheckoutUrl(session.token),
      token: session.token,
      totalCents,
    });
  }

  if (method === "TIPPIE") {
    for (const order of orders) {
      await prisma.order.update({ where: { id: order.id }, data: { paymentMethod: "TIPPIE" } });
    }
    const posOrderNumber = orders[0].posOrderNumber;
    return NextResponse.json({
      method,
      paymentUrl: buildTippieUrl(totalCents, posOrderNumber != null ? `Bestellnummer${posOrderNumber}` : undefined),
      totalCents,
    });
  }

  // TERMINAL + CASH need no remote session, cashier confirms on device.
  await prisma.order.updateMany({
    where: { posGroupId, posConfirmToken },
    data: { paymentMethod: method },
  });

  return NextResponse.json({ method, totalCents });
}
