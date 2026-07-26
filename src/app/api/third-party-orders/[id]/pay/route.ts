import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { prisma } from "@/lib/db";
import { createRbankPayment } from "@/lib/rbank";
import { formatEuro } from "@/lib/format";
import { formatGiftCardCode } from "@/lib/gift-card";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const order = await prisma.thirdPartyOrder.findUnique({ where: { id } });

    if (!order || order.userId !== user.id) {
      return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
    }

    if (!order.amountCents || order.amountCents <= 0) {
      return NextResponse.json({ error: "Kein Preis gesetzt." }, { status: 400 });
    }

    if (order.status !== "QUOTED") {
      return NextResponse.json({ error: "Bestellung kann nicht bezahlt werden." }, { status: 400 });
    }

    let giftCardDeduction = 0;
    let giftCardCodeUsed: string | null = null;

    try {
      const body = (await request.json()) as { giftCardCode?: string };
      const rawCode = typeof body.giftCardCode === "string" ? body.giftCardCode.trim() : "";

      if (rawCode) {
        const formattedCode = formatGiftCardCode(rawCode);
        const gc = await prisma.giftCard.findUnique({ where: { code: formattedCode } });

        if (!gc || gc.status !== "ACTIVE" || gc.remainingBalance <= 0) {
          return NextResponse.json({ error: "Ungültiger oder aufgebrauchter Gutscheincode." }, { status: 400 });
        }

        if (gc.buyerId !== user.id) {
          return NextResponse.json({ error: "Dieser Gutscheincode gehört dir nicht." }, { status: 400 });
        }

        giftCardDeduction = Math.min(gc.remainingBalance, order.amountCents);
        giftCardCodeUsed = formattedCode;
      }
    } catch {
      // no body or invalid JSON — proceed without gift card
    }

    const paymentAmount = order.amountCents - giftCardDeduction;

    const appUrl = getAppUrl();
    const redirectUrl = `${appUrl}/bestellungen/complete?thirdPartyOrderId=${order.id}`;
    const cancelUrl = `${appUrl}/bestellungen?cancelled=1`;

    if (paymentAmount <= 0) {
      await prisma.thirdPartyOrder.update({
        where: { id },
        data: {
          status: "ORDERED",
          orderedAt: new Date(),
          giftCardCodeUsed,
          giftCardDeduction,
        },
      });

      if (giftCardCodeUsed && giftCardDeduction > 0) {
        await prisma.giftCard.update({
          where: { code: giftCardCodeUsed },
          data: { remainingBalance: { decrement: giftCardDeduction } },
        });
      }

      return NextResponse.json({ paid: true, message: "Mit Gutschein bezahlt." });
    }

    const session = await createRbankPayment({
      amount: paymentAmount,
      description: `Drittshop: ${order.shopName} - ${user.displayName}${giftCardDeduction > 0 ? ` (Gutschein ${formatEuro(giftCardDeduction)})` : ""}`,
      redirectUrl,
      cancelUrl,
      metadata: {
        thirdPartyOrderId: order.id,
        userId: user.id,
      },
    });

    await prisma.thirdPartyOrder.update({
      where: { id },
      data: {
        paymentToken: session.token,
        giftCardCodeUsed,
        giftCardDeduction: giftCardDeduction > 0 ? giftCardDeduction : null,
      },
    });

    return NextResponse.json({ paymentUrl: session.paymentUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }
    console.error("Third-party pay failed:", error);
    return NextResponse.json({ error: "Zahlung konnte nicht gestartet werden." }, { status: 500 });
  }
}
