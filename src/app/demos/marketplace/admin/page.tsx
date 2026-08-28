import { formatEuro } from "@/lib/format";
import { getDemoAdminStats } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default function DemoAdminDashboardPage() {
  const stats = getDemoAdminStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-mute mt-1">Willkommen, Rundi Xie. (Demo-Verkäufer)</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Produkte</p>
          <p className="text-3xl font-bold mt-1">{stats.productCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Bestellungen</p>
          <p className="text-3xl font-bold mt-1">{stats.orderCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Bezahlte Bestellungen</p>
          <p className="text-3xl font-bold mt-1">{stats.paidOrderCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Umsatz</p>
          <p className="text-3xl font-bold mt-1">{formatEuro(stats.grossRevenue)}</p>
          <p className="mt-1 text-xs text-mute">Cash {formatEuro(stats.cashRevenue)} · Gutschein {formatEuro(stats.giftCardRevenue)}</p>
        </div>
        <div className="rounded-2xl border-2 border-accent bg-accent/5 p-5">
          <p className="text-sm text-accent font-semibold">Geldbeutel</p>
          <p className="text-3xl font-black mt-1 text-accent">{formatEuro(stats.sellerBalanceCents)}</p>
          <p className="mt-1 text-xs text-mute">Verfügbar für Auszahlung</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Concierge-Anfragen</p>
          <p className="text-3xl font-bold mt-1">{stats.tpoCount}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-line bg-white p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold">Auszahlung beantragen</h2>
            <p className="mt-2 text-sm text-mute">
              Dein Guthaben beträgt <strong>{formatEuro(stats.sellerBalanceCents)}</strong>.
              Bei einer Auszahlung wird eine Gebühr von 5% + 55&nbsp;Cent erhoben.
            </p>
          </div>
          <button
            disabled
            title="In der Demo deaktiviert"
            className="rounded-xl bg-tile px-5 py-3 text-sm font-bold text-mute cursor-not-allowed"
          >
            Auszahlung beantragen
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Letzte bezahlte Bestellungen</h2>
          <a href="/demos/marketplace/admin/products" className="text-sm text-accent hover:underline font-medium">Alle Produkte</a>
        </div>
        {stats.recentPaidOrders.length === 0 ? (
          <p className="text-mute text-sm">Noch keine Bestellungen.</p>
        ) : (
          <div className="space-y-2">
            {stats.recentPaidOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-line bg-white px-5 py-3">
                <div>
                  <p className="font-medium text-sm">{o.product.title}</p>
                  <p className="text-xs text-mute">
                    {o.buyerName} &middot; {new Date(o.createdAt).toLocaleDateString("de-DE")}
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
