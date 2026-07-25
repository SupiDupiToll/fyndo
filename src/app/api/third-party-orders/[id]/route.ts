import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hexclaveServerApp } from "@/hexclave/server";
import { formatEuro } from "@/lib/format";

async function sendStatusEmail(order: {
  id: string;
  status: string;
  shopName: string;
  productUrl: string;
  amountCents: number | null;
  user: { stackUserId: string; email: string; displayName: string };
}) {
  const statusMessages: Record<string, { subject: string; body: string }> = {
    QUOTED: {
      subject: "Preis für deine Concierge-Bestellung steht fest",
      body: `für deine Anfrage bei <strong>${order.shopName}</strong> wurde ein Preis festgelegt: <strong>${order.amountCents ? formatEuro(order.amountCents) : "?"}</strong>.<br/><br/>Gehe zu deinen Bestellungen, um zu bezahlen.`,
    },
    ORDERED: {
      subject: "Deine Concierge-Bestellung wurde ausgelöst",
      body: `deine Bestellung bei <strong>${order.shopName}</strong> wurde vom Team bestellt. Du bekommst Bescheid, sobald sie da ist.`,
    },
    DONE: {
      subject: "Deine Concierge-Bestellung ist da",
      body: `deine Bestellung bei <strong>${order.shopName}</strong> ist eingetroffen und kann abgeholt werden.`,
    },
    CANCELLED: {
      subject: "Concierge-Bestellung storniert",
      body: `deine Anfrage bei <strong>${order.shopName}</strong> wurde storniert.`,
    },
  };

  const msg = statusMessages[order.status];
  if (!msg) return;

  await hexclaveServerApp().sendEmail({
    userIds: [order.user.stackUserId],
    subject: msg.subject,
    notificationCategoryName: "Transactional",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 8px">${msg.subject}</h2>
      <p style="color:#475569;line-height:1.6">Hallo ${order.user.displayName},<br/><br/>${msg.body}</p>
      <p style="color:#94a3b8;font-size:13px;margin-top:24px">
        <a href="${order.productUrl}" style="color:#0066FF">${order.productUrl.length > 60 ? order.productUrl.slice(0, 60) + "..." : order.productUrl}</a>
      </p>
    </div>`,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as {
    amountCents?: number | null;
    adminNote?: string | null;
    status?: "REQUESTED" | "QUOTED" | "ORDERED" | "DONE" | "CANCELLED";
  };

  const order = await prisma.thirdPartyOrder.findUnique({
    where: { id },
    include: { user: { select: { stackUserId: true, email: true, displayName: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.amountCents !== undefined) {
    updateData.amountCents = body.amountCents;
  }

  if (body.adminNote !== undefined) {
    updateData.adminNote = body.adminNote || null;
  }

  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === "QUOTED") updateData.quotedAt = new Date();
    if (body.status === "ORDERED") updateData.orderedAt = new Date();
    if (body.status === "DONE") updateData.fulfilledAt = new Date();
  }

  const updated = await prisma.thirdPartyOrder.update({
    where: { id },
    data: updateData,
  });

  if (body.status) {
    sendStatusEmail({
      id: order.id,
      status: body.status,
      shopName: order.shopName,
      productUrl: order.productUrl,
      amountCents: body.amountCents ?? order.amountCents,
      user: order.user,
    }).catch((err) => console.error("Email failed:", err));
  }

  return NextResponse.json(updated);
}
