import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { posGroupId?: string; posConfirmToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabedaten." }, { status: 400 });
  }

  const posGroupId = String(body.posGroupId ?? "");
  const posConfirmToken = String(body.posConfirmToken ?? "");

  if (!posGroupId || !posConfirmToken) {
    return NextResponse.json({ error: "Bestellung fehlt." }, { status: 400 });
  }

  const updated = await prisma.order.updateMany({
    where: { posGroupId, posConfirmToken, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  if (updated.count > 0) {
    const orders = await prisma.order.findMany({
      where: { posGroupId },
      select: { posCardId: true },
    });
    const cardIds = Array.from(new Set(orders.map((o) => o.posCardId).filter(Boolean))) as string[];
    if (cardIds.length > 0) {
      await prisma.posNumberCard.updateMany({
        where: { id: { in: cardIds }, used: true },
        data: { used: false, usedAt: null, orderId: null },
      });
    }
  }

  return NextResponse.json({ ok: updated.count > 0 });
}
