import { demoThirdPartyOrders } from "@/lib/demo-data";
import { formatEuro } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  REQUESTED: "Anfrage",
  QUOTED: "Preis gesetzt",
  ORDERED: "Bestellt",
  DONE: "Erledigt",
  CANCELLED: "Storniert",
};

const statusColors: Record<string, string> = {
  REQUESTED: "bg-yellow-50 text-yellow-700",
  QUOTED: "bg-blue-50 text-blue-700",
  ORDERED: "bg-purple-50 text-purple-700",
  DONE: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-50 text-gray-500",
};

export default function DemoAdminConciergePage() {
  const orders = demoThirdPartyOrders;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Concierge</h1>
        <p className="text-mute mt-1">Drittshop-Anfragen verwalten. (Demo – nur Ansicht)</p>
      </div>

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {o.shopFaviconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.shopFaviconUrl} alt="" className="h-6 w-6 rounded" />
                )}
                <div>
                  <p className="font-bold">{o.shopName}</p>
                  <p className="text-xs text-mute">{o.shopHost}</p>
                </div>
              </div>
              <span className={`text-xs font-bold rounded-full px-3 py-1 ${statusColors[o.status] ?? ""}`}>
                {statusLabels[o.status] ?? o.status}
              </span>
            </div>

            <div className="text-sm space-y-1 mb-3">
              <p>
                <span className="text-mute">Link:</span>{" "}
                <a href={o.productUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {o.productUrl.length > 60 ? o.productUrl.slice(0, 60) + "..." : o.productUrl}
                </a>
              </p>
              <p>
                <span className="text-mute">Kunde:</span> {o.user.displayName} ({o.user.email})
              </p>
              {o.customerNote && <p><span className="text-mute">Hinweis:</span> {o.customerNote}</p>}
              {o.amountCents != null && (
                <p>
                  <span className="text-mute">Preis:</span> {formatEuro(o.amountCents)}
                </p>
              )}
              {o.adminNote && <p><span className="text-mute">Admin:</span> {o.adminNote}</p>}
              <p className="text-xs text-mute">{new Date(o.createdAt).toLocaleDateString("de-DE")}</p>
            </div>

            <div className="flex gap-2 border-t border-line pt-3 mt-3">
              <span className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-mute">Bearbeiten</span>
              {o.status === "QUOTED" && (
                <span className="rounded-lg bg-purple-50 text-purple-300 px-4 py-2 text-sm font-bold">Bestellt</span>
              )}
              {o.status === "ORDERED" && (
                <span className="rounded-lg bg-green-50 text-green-300 px-4 py-2 text-sm font-bold">Erledigt</span>
              )}
              {o.status !== "CANCELLED" && o.status !== "DONE" && (
                <span className="rounded-lg border border-red-200 bg-red-50 text-red-300 px-4 py-2 text-sm font-bold ml-auto">Stornieren</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
