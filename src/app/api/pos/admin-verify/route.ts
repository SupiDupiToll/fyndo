import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePosSettings } from "@/lib/pos-settings";
import { hashAdminCode, safeEqual } from "@/lib/admin-code";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { vendor?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const vendorName = (body.vendor ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!vendorName || !code) {
    return NextResponse.json({ error: "Verkäufer und Code fehlen." }, { status: 400 });
  }

  const seller = await prisma.user.findFirst({
    where: {
      OR: [
        { sellerName: { equals: vendorName, mode: "insensitive" } },
        { displayName: { equals: vendorName, mode: "insensitive" } },
      ],
    },
    select: { posSettings: true },
  });

  const settings = parsePosSettings(seller?.posSettings);

  if (!settings.adminEnabled || !settings.adminCodeHash) {
    return NextResponse.json({ valid: false });
  }

  const candidate = await hashAdminCode(code);
  return NextResponse.json({ valid: safeEqual(candidate, settings.adminCodeHash) });
}
