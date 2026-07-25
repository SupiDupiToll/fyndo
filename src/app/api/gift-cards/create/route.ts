import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAppUrl, getRbankConfig } from "@/lib/env";
import { prisma } from "@/lib/db";
import { createRbankPayment } from "@/lib/rbank";
import { isDemoUser } from "@/lib/demo";

export async function POST(request: NextRequest) {
  const appUrl = getAppUrl();

  try {
    const user = await requireUser();

    if (isDemoUser(user)) {
      return NextResponse.json({ error: "Demo-Nutzer duerfen nichts bestellen." }, { status: 403 });
    }

    const body = (await request.json()) as { amountCents?: number; message?: string };
    const amountCents = Number(body.amountCents ?? 0);
    const message = typeof body.message === "string" ? body.message.trim() || null : null;

    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 10000) {
      return NextResponse.json({ error: "Ungültiger Betrag." }, { status: 400 });
    }

    const giftCard = await prisma.giftCard.create({
      data: {
        amountCents,
        remainingBalance: amountCents,
        buyerId: user.id,
        buyerEmail: user.email,
        message,
        status: "PENDING",
      },
    });

    const redirectUrl = `${appUrl}/gift-cards/complete?id=${giftCard.id}`;
    const cancelUrl = `${appUrl}/gift-cards?cancelled=1`;

    const session = await createRbankPayment({
      amount: amountCents,
      description: `Geschenkgutschein ${amountCents / 100}€ - ${user.displayName}`,
      redirectUrl,
      cancelUrl,
      metadata: {
        giftCardId: giftCard.id,
        userId: user.id,
      },
    });

    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { paymentToken: session.token },
    });

    return NextResponse.json({ paymentUrl: session.paymentUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }
    console.error("Gift card create failed:", error);
    return NextResponse.json({ error: "Gutschein konnte nicht erstellt werden." }, { status: 500 });
  }
}
