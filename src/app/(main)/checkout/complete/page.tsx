import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatEuro } from "@/lib/format";
import { prisma } from "@/lib/db";
import { sendOrderNotification } from "@/lib/ntfy";
import { verifyRbankPayment } from "@/lib/rbank";

export const dynamic = "force-dynamic";

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; token?: string; orderIds?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Checkout Rückkehr</h1>
        <p className="mt-2 text-mute">Bitte einloggen, um die Bestellung zu sehen.</p>
        <a href="/handler/sign-in" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Einloggen
        </a>
      </div>
    );
  }

  const token = params.token ?? "";
  const orderIdsParam = params.orderIds ?? params.orderId ?? "";

  if (!orderIdsParam) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold">Keine Bestellung gefunden</h1>
        <Link href="/" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Zum Shop
        </Link>
      </div>
    );
  }

  const orderIdList = orderIdsParam.split(",").filter(Boolean);
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIdList } },
    include: { product: { include: { seller: { select: { sellerName: true } } } } },
  });

  if (orders.length === 0 || orders.some((o) => o.userId !== user.id)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold text-red-600">Bestellung nicht gefunden</h1>
        <Link href="/" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Zum Shop
        </Link>
      </div>
    );
  }

  const firstOrder = orders[0];
  const allPaid = orders.every((o) => o.status === "PAID" || o.status === "DONE");
  const allPending = orders.every((o) => o.status === "PENDING");

  let message = "Zahlung noch nicht bestätigt.";
  let success = false;

  if (allPaid) {
    message = orders.length > 1 ? "Alle Zahlungen bestätigt." : "Zahlung ist bestätigt.";
    success = true;
  } else if (token && allPending && orders.some((o) => o.paymentToken === token)) {
    const verification = await verifyRbankPayment(token);

    const totalCents = orders.reduce((s, o) => s + o.amountCents, 0);

    if (
      verification.status === "COMPLETED" &&
      verification.amount === totalCents
    ) {
      const updated = await prisma.order.updateMany({
        where: { id: { in: orderIdList }, status: "PENDING", notificationSentAt: null },
        data: { status: "PAID", notificationSentAt: new Date() },
      });

      if (updated.count > 0) {
        for (const order of orders) {
          await sendOrderNotification({
            buyerEmail: order.buyerEmail,
            productName: order.product.title,
            amountCents: order.amountCents,
            voucherFaceValueCents: order.voucherFaceValueCents,
            sellerName: order.product.seller.sellerName,
          }).catch((err) => console.error("NTFY failed:", err));

          if (order.giftCardCodeUsed && order.giftCardDeduction) {
            await prisma.giftCard.update({
              where: { code: order.giftCardCodeUsed },
              data: { remainingBalance: { decrement: order.giftCardDeduction } },
            }).catch((err) => console.error("GiftCard deduct failed:", err));
          }

          await prisma.user.update({
            where: { id: order.product.sellerId },
            data: { sellerBalanceCents: { increment: order.amountCents + (order.giftCardDeduction ?? 0) } },
          }).catch((err) => console.error("Seller balance update failed:", err));
        }
      }

      message = orders.length > 1 ? "Zahlung für alle Artikel bestätigt. Vielen Dank!" : "Zahlung bestätigt. Vielen Dank!";
      success = true;
    } else {
      message = `Checkout-Status: ${verification.status}`;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        {orders.length > 1
          ? `${orders.length} Bestellungen`
          : `${firstOrder.product.title}${firstOrder.variantName ? ` (${firstOrder.variantName})` : ""}`}
      </h1>
      <div className="mt-8 p-8 bg-white rounded-3xl border border-line shadow-sm max-w-md">
        <p className="text-mute">{message}</p>
        <p className={success ? "mt-3 text-3xl font-black text-green-600" : "mt-3 text-3xl font-black text-red-600"}>
          {formatEuro(orders.reduce((s, o) => s + o.amountCents, 0))}
        </p>
      </div>
      <div className="mt-8 flex gap-4">
        <Link href="/" className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Zum Shop
        </Link>
        <Link href="/bestellungen" className="rounded-full border border-line px-8 py-3 text-sm font-bold text-ink hover:bg-surf transition-all">
          Meine Bestellungen
        </Link>
      </div>
    </div>
  );
}
