import { prisma } from "@/lib/db";
import { sendPosOrderNotification } from "@/lib/ntfy";

export async function finalizePosGroup(
  posGroupId: string,
  posConfirmToken: string,
  method: string,
) {
  const orders = await prisma.order.findMany({
    where: { posGroupId, posConfirmToken },
    include: {
      product: {
        include: { seller: { select: { id: true, sellerName: true, displayName: true } } },
      },
    },
  });

  if (orders.length === 0) return { notFound: true as const };

  const totalCents = orders.reduce((sum, o) => sum + o.amountCents, 0);
  const grossTotalCents = orders.reduce(
    (sum, o) => sum + o.amountCents + (o.giftCardDeduction ?? 0),
    0,
  );

  const updated = await prisma.order.updateMany({
    where: { posGroupId, posConfirmToken, status: "PENDING", notificationSentAt: null },
    data: { status: "PAID", paymentMethod: method, notificationSentAt: new Date() },
  });

  if (updated.count === 0) {
    return { alreadyPaid: true as const, totalCents, itemCount: orders.length };
  }

  for (const order of orders) {
    const deduction = order.giftCardDeduction ?? 0;

    if (order.giftCardCodeUsed && deduction > 0) {
      await prisma.giftCard
        .update({
          where: { code: order.giftCardCodeUsed },
          data: { remainingBalance: { decrement: deduction } },
        })
        .catch((err) => console.error("POS GiftCard deduct failed:", err));
    }

    const credit = method === "CASH" ? deduction : order.amountCents + deduction;
    if (credit > 0) {
      await prisma.user
        .update({
          where: { id: order.product.sellerId },
          data: { sellerBalanceCents: { increment: credit } },
        })
        .catch((err) => console.error("POS Seller balance update failed:", err));
    }
  }

  const seller = orders[0].product.seller;
  await sendPosOrderNotification({
    sellerName: seller.sellerName ?? seller.displayName,
    items: orders.map((o) => ({
      productName: o.product.title,
      containerName: o.posContainerName,
      amountCents: o.amountCents + (o.giftCardDeduction ?? 0),
    })),
    totalCents: grossTotalCents,
    method,
  }).catch((err) => console.error("POS NTFY failed:", err));

  return { ok: true as const, totalCents, itemCount: orders.length };
}
