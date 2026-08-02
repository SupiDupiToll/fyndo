import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { VendorPayoutRequestButton } from "@/components/vendor-payout-request-button";
import type { Prisma, OrderStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await requireSellerOrSuperAdmin();
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const productFilter = isSuperAdmin ? {} : { sellerId: user.id };
  const paidStatuses: OrderStatus[] = ["PAID", "DONE"];
  const paidOrderFilter = {
    status: { in: paidStatuses },
    ...(isSuperAdmin ? {} : { product: { sellerId: user.id } }),
  };
  type RecentPaidOrder = Prisma.OrderGetPayload<{
    include: {
      product: { select: { title: true } };
      user: { select: { displayName: true } };
    };
  }>;

  const [productCount, orderCount, paidOrderCount, paidOrderTotals, recentPaidOrders] = await Promise.all([
    prisma.product.count({ where: { ...productFilter } }),
    prisma.order.count({ where: isSuperAdmin ? {} : { product: { sellerId: user.id } } }),
    prisma.order.count({ where: paidOrderFilter }),
    prisma.order.aggregate({ where: paidOrderFilter, _sum: { amountCents: true, giftCardDeduction: true } }),
    prisma.order.findMany({
      where: paidOrderFilter,
      include: { product: { select: { title: true } }, user: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }) as Promise<RecentPaidOrder[]>,
  ]);

  const cashRevenue = paidOrderTotals._sum?.amountCents ?? 0;
  const giftCardRevenue = paidOrderTotals._sum?.giftCardDeduction ?? 0;
  const grossRevenue = cashRevenue + giftCardRevenue;
  const tpoCount = isSuperAdmin ? await prisma.thirdPartyOrder.count() : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-mute mt-1">Willkommen, {user.displayName}.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Produkte</p>
          <p className="text-3xl font-bold mt-1">{productCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Bestellungen</p>
          <p className="text-3xl font-bold mt-1">{orderCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Bezahlte Bestellungen</p>
          <p className="text-3xl font-bold mt-1">{paidOrderCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Umsatz</p>
          <p className="text-3xl font-bold mt-1">{formatEuro(grossRevenue)}</p>
          <p className="mt-1 text-xs text-mute">Cash {formatEuro(cashRevenue)} · Gutschein {formatEuro(giftCardRevenue)}</p>
        </div>
        {!isSuperAdmin && (
          <div className="rounded-2xl border-2 border-accent bg-accent/5 p-5">
            <p className="text-sm text-accent font-semibold">Geldbeutel</p>
            <p className="text-3xl font-black mt-1 text-accent">{formatEuro(user.sellerBalanceCents)}</p>
            <p className="mt-1 text-xs text-mute">Verfügbar für Auszahlung</p>
          </div>
        )}
        {tpoCount !== null && (
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm text-mute font-medium">Concierge-Anfragen</p>
            <p className="text-3xl font-bold mt-1">{tpoCount}</p>
          </div>
        )}
      </div>

      {!isSuperAdmin && (
        <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold">Auszahlung beantragen</h2>
              <p className="mt-2 text-sm text-mute">
                Dein Guthaben beträgt <strong>{formatEuro(user.sellerBalanceCents)}</strong>.
                Bei einer Auszahlung wird eine Gebühr von 3% + 15&nbsp;Cent erhoben.
                Nach der Anfrage wird der Betrag zurückgesetzt und der Admin per E-Mail benachrichtigt.
              </p>
            </div>
            <VendorPayoutRequestButton />
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Letzte bezahlte Bestellungen</h2>
          <a href="/admin/products" className="text-sm text-accent hover:underline font-medium">Alle Produkte</a>
        </div>
        {recentPaidOrders.length === 0 ? (
          <p className="text-mute text-sm">Noch keine Bestellungen.</p>
        ) : (
          <div className="space-y-2">
            {recentPaidOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-line bg-white px-5 py-3">
                <div>
                  <p className="font-medium text-sm">{o.product.title}</p>
                  <p className="text-xs text-mute">
                    {o.user?.displayName ?? "POS"} &middot; {new Date(o.createdAt).toLocaleDateString("de-DE")}
                    {o.giftCardDeduction ? ` · Gutschein ${formatEuro(o.giftCardDeduction)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold">{formatEuro(o.amountCents + (o.giftCardDeduction ?? 0))}</span>
                  {o.giftCardDeduction ? <p className="text-[11px] text-mute">Mit Gutschein bezahlt</p> : <p className="text-[11px] text-mute">Direkt bezahlt</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
