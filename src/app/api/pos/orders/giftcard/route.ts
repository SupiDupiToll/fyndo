import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatGiftCardCode } from "@/lib/gift-card";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { posGroupId?: string; posConfirmToken?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabedaten." }, { status: 400 });
  }

  const posGroupId = String(body.posGroupId ?? "");
  const posConfirmToken = String(body.posConfirmToken ?? "");
  const rawCode = String(body.code ?? "").trim();

  if (!posGroupId || !posConfirmToken) {
    return NextResponse.json({ error: "Bestellung fehlt." }, { status: 400 });
  }
  if (!rawCode) {
    return NextResponse.json({ error: "Bitte einen Gutscheincode eingeben." }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { posGroupId, posConfirmToken, status: "PENDING" },
  });

  if (orders.length === 0) {
    return NextResponse.json(
      { error: "Bestellung nicht gefunden oder bereits abgeschlossen." },
      { status: 404 },
    );
  }

  const formattedCode = formatGiftCardCode(rawCode);

  const giftCard = await prisma.giftCard.findUnique({
    where: { code: formattedCode },
  });

  if (!giftCard || giftCard.status !== "ACTIVE" || giftCard.remainingBalance <= 0) {
    return NextResponse.json(
      { error: "Ungültiger oder aufgebrauchter Gutscheincode." },
      { status: 400 },
    );
  }

  const totalCents = orders.reduce((sum, o) => sum + o.amountCents, 0);
  const deduction = Math.min(giftCard.remainingBalance, totalCents);

  if (deduction <= 0) {
    return NextResponse.json(
      { error: "Gutschein hat keinen einlösbaren Betrag." },
      { status: 400 },
    );
  }

  let remaining = deduction;
  for (const order of orders) {
    const take = Math.min(order.amountCents, remaining);
    if (take <= 0) continue;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        amountCents: order.amountCents - take,
        giftCardDeduction: (order.giftCardDeduction ?? 0) + take,
        giftCardCodeUsed: formattedCode,
      },
    });
    remaining -= take;
  }

  return NextResponse.json({
    ok: true,
    deduction,
    remainder: totalCents - deduction,
    giftCardCode: formattedCode,
  });
}
