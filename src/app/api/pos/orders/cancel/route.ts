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

  return NextResponse.json({ ok: updated.count > 0 });
}
