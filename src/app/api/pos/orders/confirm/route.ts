import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRbankPayment } from "@/lib/rbank";
import { finalizePosGroup } from "@/lib/pos-finalize";
import { POS_PAYMENT_METHODS, type PosPaymentMethod } from "@/lib/pos";

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

  const orders = await prisma.order.findMany({
    where: { posGroupId, posConfirmToken },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }

  if (method === "RBANK") {
    const paymentToken = orders[0].paymentToken?.split("__")[0];
    if (!paymentToken) {
      return NextResponse.json({ error: "Keine RBank-Session vorhanden." }, { status: 409 });
    }

    const totalCents = orders.reduce((sum, o) => sum + o.amountCents, 0);
    const verification = await verifyRbankPayment(paymentToken);

    if (verification.status !== "COMPLETED" || verification.amount !== totalCents) {
      return NextResponse.json({
        error: `Zahlung noch nicht bestätigt (Status: ${verification.status}).`,
        status: verification.status,
      }, { status: 409 });
    }
  }

  const result = await finalizePosGroup(posGroupId, posConfirmToken, method);

  if (result.notFound) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }
  if (result.alreadyPaid) {
    return NextResponse.json({ ok: true, alreadyPaid: true, totalCents: result.totalCents });
  }

  return NextResponse.json({ ok: true, totalCents: result.totalCents, itemCount: result.itemCount });
}
