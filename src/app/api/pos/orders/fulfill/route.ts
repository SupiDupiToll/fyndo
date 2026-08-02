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

  const orders = await prisma.order.findMany({
    where: { posGroupId, posConfirmToken },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.order.updateMany({
    where: { posGroupId, posConfirmToken, status: { in: ["PAID", "DONE"] } },
    data: { status: "DONE", fulfilledAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Bestellung ist noch nicht bezahlt." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
