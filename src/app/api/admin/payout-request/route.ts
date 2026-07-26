import { NextRequest, NextResponse } from "next/server";
import { hexclaveServerApp } from "@/hexclave/server";
import { getAdminEmailList, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  let note = "";

  try {
    const user = await requireUser();

    if (user.role !== "SELLER") {
      return NextResponse.json({ error: "Nur Verkäufer können eine Auszahlung beantragen." }, { status: 403 });
    }

    try {
      const body = (await request.json()) as { note?: string };
      note = typeof body.note === "string" ? body.note.trim() : "";
    } catch {
      note = "";
    }

    const balanceCents = user.sellerBalanceCents;
    if (balanceCents <= 0) {
      return NextResponse.json({ error: "Dein Guthaben beträgt 0 €." }, { status: 400 });
    }

    const feeCents = Math.round(balanceCents * 0.03) + 15;
    const netCents = Math.max(balanceCents - feeCents, 0);

    const adminEmails = getAdminEmailList();
    const admins = adminEmails.length > 0
      ? await prisma.user.findMany({
          where: { email: { in: adminEmails } },
          select: { stackUserId: true, email: true, displayName: true },
        })
      : [];

    if (admins.length === 0) {
      return NextResponse.json({ error: "Kein Admin für die Auszahlung gefunden." }, { status: 500 });
    }

    const recentOrders = await prisma.order.findMany({
      where: {
        status: { in: ["PAID", "DONE"] as const },
        product: { sellerId: user.id },
      },
      include: { product: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }) as Prisma.OrderGetPayload<{ include: { product: { select: { title: true } } } }>[];

    const sellerName = user.sellerName?.trim() || user.displayName;
    const subject = `Auszahlungsanfrage von ${sellerName}`;
    const orderLines = recentOrders.length > 0
      ? recentOrders.map((order) => {
          const grossOrderAmount = order.amountCents + (order.giftCardDeduction ?? 0);
          return `${order.product.title}: ${formatEuro(grossOrderAmount)}${order.giftCardDeduction ? ` (Gutschein ${formatEuro(order.giftCardDeduction)})` : ""}`;
        }).join("<br/>")
      : "Keine Detailposten vorhanden.";

    await hexclaveServerApp().sendEmail({
      userIds: admins.map((admin) => admin.stackUserId),
      subject,
      notificationCategoryName: "Transactional",
      html: `<div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 12px">${subject}</h2>
        <p style="color:#475569;line-height:1.6">
          Verkäufer: <strong>${sellerName}</strong><br/>
          E-Mail: <strong>${user.email}</strong><br/>
          Brutto: <strong>${formatEuro(balanceCents)}</strong><br/>
          Gebühr (3%+15ct): <strong>${formatEuro(feeCents)}</strong><br/>
          Auszahlungsbetrag: <strong>${formatEuro(netCents)}</strong>
        </p>
        ${note ? `<p style="color:#475569;line-height:1.6"><strong>Notiz:</strong> ${note}</p>` : ""}
        <div style="margin-top:20px;padding:16px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc">
          <p style="margin:0 0 8px;font-weight:700">Letzte bezahlte Bestellungen</p>
          <p style="margin:0;color:#475569;line-height:1.7">${orderLines}</p>
        </div>
      </div>`,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { sellerBalanceCents: 0 },
    });

    return NextResponse.json({ message: `Auszahlung von ${formatEuro(netCents)} (netto nach Gebühr) wurde beantragt.` });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }

    console.error("Payout request failed:", error);
    return NextResponse.json({ error: "Auszahlungsanfrage konnte nicht gesendet werden." }, { status: 500 });
  }
}
