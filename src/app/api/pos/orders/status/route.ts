import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRbankPayment } from "@/lib/rbank";
import { finalizePosGroup } from "@/lib/pos-finalize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const posGroupId = searchParams.get("posGroupId") ?? "";
  const posConfirmToken = searchParams.get("posConfirmToken") ?? "";

  if (!posGroupId || !posConfirmToken) {
    return NextResponse.json({ error: "Bestellung fehlt." }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { posGroupId, posConfirmToken },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }

  const status = orders.some((o) => o.status === "PENDING") ? "PENDING" : "PAID";
  const method = orders[0].paymentMethod ?? null;
  const totalCents = orders.reduce((s, o) => s + o.amountCents, 0);
  const posOrderNumber = orders[0].posOrderNumber ?? null;

  if (status === "PENDING" && method === "RBANK") {
    const paymentToken = orders[0].paymentToken?.split("__")[0];
    if (paymentToken) {
      try {
        const verification = await verifyRbankPayment(paymentToken);
        if (verification.status === "COMPLETED" && verification.amount === totalCents) {
          await finalizePosGroup(posGroupId, posConfirmToken, "RBANK");
          return NextResponse.json({
            status: "PAID",
            method: "RBANK",
            totalCents,
            posOrderNumber,
            auto: true,
          });
        }
        return NextResponse.json({
          status: "PENDING",
          method,
          totalCents,
          posOrderNumber,
          rbank: verification.status,
        });
      } catch (error) {
        console.error("POS RBANK verify failed:", error);
        return NextResponse.json({
          status: "PENDING",
          method,
          totalCents,
          posOrderNumber,
          rbank: "ERROR",
        });
      }
    }
  }

  return NextResponse.json({ status, method, totalCents, posOrderNumber });
}
