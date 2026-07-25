import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendThirdPartyOrderNotification } from "@/lib/ntfy";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const orders = await prisma.thirdPartyOrder.findMany({
    include: { user: { select: { displayName: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = (await request.json()) as { productUrl?: string; customerNote?: string };
    const { productUrl, customerNote } = body;

    if (!productUrl) {
      return NextResponse.json({ error: "Produkt-URL ist erforderlich." }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(productUrl.trim());
    } catch {
      return NextResponse.json({ error: "Ungueltige URL." }, { status: 400 });
    }

    const shopName = parsedUrl.hostname.replace(/^www\./i, "");
    const shopHost = parsedUrl.hostname;

    const order = await prisma.thirdPartyOrder.create({
      data: {
        userId: user.id,
        productUrl: productUrl.trim(),
        shopName,
        shopHost,
        shopFaviconUrl: `${parsedUrl.origin}/favicon.ico`,
        customerNote: customerNote?.trim() || null,
        status: "REQUESTED",
      },
    });

    await sendThirdPartyOrderNotification({
      buyerEmail: user.email,
      productUrl: order.productUrl,
      shopName: order.shopName,
      shopHost: order.shopHost,
      customerNote: order.customerNote,
    }).catch((err) => console.error("NTFY failed:", err));

    return NextResponse.json({ message: "Drittshop-Bestellung wurde erstellt.", id: order.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }
    return NextResponse.json({ error: "Bestellung konnte nicht erstellt werden." }, { status: 500 });
  }
}
