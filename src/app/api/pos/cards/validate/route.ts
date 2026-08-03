import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPosCardSecret } from "@/lib/env";
import { decodeCardToken } from "@/lib/pos-cards";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { vendor?: string; cardToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabedaten." }, { status: 400 });
  }

  const vendorName = String(body.vendor ?? "").trim();
  const cardToken = String(body.cardToken ?? "").trim();

  if (!vendorName) {
    return NextResponse.json({ error: "Verkäufer fehlt." }, { status: 400 });
  }
  if (!cardToken) {
    return NextResponse.json({ error: "Bitte zuerst eine Karte scannen." }, { status: 400 });
  }

  const vendor = await prisma.user.findFirst({
    where: { OR: [{ sellerName: vendorName }, { displayName: vendorName }] },
  });

  if (!vendor) {
    return NextResponse.json({ error: "Verkäufer nicht gefunden." }, { status: 404 });
  }

  const number = decodeCardToken(getPosCardSecret(), vendor.id, cardToken);
  if (number === null) {
    return NextResponse.json({ error: "Ungültige Karte." }, { status: 400 });
  }

  const card = await prisma.posNumberCard.findFirst({
    where: { sellerId: vendor.id, number },
  });

  if (!card) {
    return NextResponse.json({ error: "Ungültige Karte." }, { status: 400 });
  }
  if (card.used) {
    return NextResponse.json({ error: "Karte wurde bereits verwendet." }, { status: 409 });
  }

  return NextResponse.json({ number, used: false });
}
