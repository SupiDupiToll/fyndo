import { formatEuro } from "@/lib/format";
import { demoOrders, demoThirdPartyOrders } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const orderStatusLabels: Record<string, string> = {
  PENDING: "Ausstehend",
  PAID: "Bezahlt",
  DONE: "Erledigt",
  CANCELLED: "Storniert",
};

const orderStatusColors: Record<string, string> = {
  PENDING: "text-yellow-600 bg-yellow-50",
  PAID: "text-green-600 bg-green-50",
  DONE: "text-blue-600 bg-blue-50",
  CANCELLED: "text-gray-600 bg-gray-50",
};

const thirdPartyStatusLabels: Record<string, string> = {
  REQUESTED: "Anfrage",
  QUOTED: "Preis gesetzt",
  ORDERED: "Bestellt",
  DONE: "Erledigt",
  CANCELLED: "Storniert",
};

export default function DemoBestellungenPage() {
  const orders = demoOrders;
  const thirdPartyOrders = demoThirdPartyOrders;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Meine Bestellungen</h1>
        <p className="mt-1 text-sm text-mute">
          Hier siehst du deine Käufe und Drittshop-Bestellungen. (Demo-Daten)
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-4">Shop-Bestellungen</h2>
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-xl bg-tile">
                  {order.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={order.product.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-mute">Bild</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {order.product.title}
                    {order.variantName ? ` (${order.variantName})` : ""}
                  </p>
                  <p className="text-sm text-mute">
                    {formatEuro(order.amountCents)}
                    {order.voucherFaceValueCents ? ` (Gutscheinwert: ${formatEuro(order.voucherFaceValueCents)})` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:text-right ml-0 sm:ml-auto">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${orderStatusColors[order.status] ?? "text-mute bg-tile"}`}>
                  {orderStatusLabels[order.status] ?? order.status}
                </span>
                <span className="text-mute text-xs">{new Date(order.createdAt).toLocaleDateString("de-DE")}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Drittshop-Vorgänge</h2>
        <div className="space-y-3">
          {thirdPartyOrders.map((tpo) => (
            <div key={tpo.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{tpo.shopName}</p>
                  <p className="text-sm text-mute">{tpo.shopHost}</p>
                </div>
                <span className="text-xs font-bold rounded-full px-3 py-1 bg-tile text-mute">
                  {thirdPartyStatusLabels[tpo.status] ?? tpo.status}
                </span>
              </div>
              <div className="mt-2">
                <a href={tpo.productUrl} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline truncate block">
                  {tpo.productUrl}
                </a>
              </div>
              {tpo.customerNote && (
                <p className="mt-1 text-sm text-mute">Hinweis: {tpo.customerNote}</p>
              )}
              {tpo.adminNote && (
                <p className="mt-1 text-sm text-mute">Admin: {tpo.adminNote}</p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold">
                    {typeof tpo.amountCents === "number" ? formatEuro(tpo.amountCents) : "Preis offen"}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-mute">
                {new Date(tpo.createdAt).toLocaleDateString("de-DE")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
