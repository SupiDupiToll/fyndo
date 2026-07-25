import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatGiftCardCode } from "@/lib/gift-card";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: string };
    const rawCode = body.code?.trim() ?? "";

    if (!rawCode) {
      return NextResponse.json({ error: "Bitte einen Code eingeben." }, { status: 400 });
    }

    const formatted = formatGiftCardCode(rawCode);

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: formatted },
    });

    if (!giftCard) {
      return NextResponse.json({ error: "Ungültiger Gutscheincode." }, { status: 404 });
    }

    if (giftCard.status !== "ACTIVE") {
      return NextResponse.json({ error: "Dieser Gutschein ist nicht aktiv." }, { status: 400 });
    }

    if (giftCard.remainingBalance <= 0) {
      return NextResponse.json({ error: "Dieser Gutschein ist aufgebraucht." }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      remainingBalance: giftCard.remainingBalance,
      originalAmount: giftCard.amountCents,
    });
  } catch {
    return NextResponse.json({ error: "Fehler bei der Prüfung." }, { status: 500 });
  }
}
