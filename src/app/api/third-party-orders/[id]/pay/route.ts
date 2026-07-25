import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { prisma } from "@/lib/db";
import { createRbankPayment } from "@/lib/rbank";
import { formatEuro } from "@/lib/format";

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

    const appUrl = getAppUrl();
    const redirectUrl = `${appUrl}/bestellungen/complete?thirdPartyOrderId=${order.id}`;
    const cancelUrl = `${appUrl}/bestellungen?cancelled=1`;

    const session = await createRbankPayment({
      amount: order.amountCents,
      description: `Drittshop: ${order.shopName} - ${user.displayName}`,
      redirectUrl,
      cancelUrl,
      metadata: {
        thirdPartyOrderId: order.id,
        userId: user.id,
      },
    });

    await prisma.thirdPartyOrder.update({
      where: { id },
      data: { paymentToken: session.token },
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
