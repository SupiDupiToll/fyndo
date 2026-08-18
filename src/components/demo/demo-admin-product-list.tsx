import { formatEuro } from "@/lib/format";
import type { DemoProduct } from "@/lib/demo-data";

export function DemoAdminProductList({ products }: { products: DemoProduct[] }) {
  return (
    <div className="space-y-2">
      {products.map((p) => (
        <div key={p.id} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-tile">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-mute">Bild</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{p.title}</p>
            <p className="text-sm text-mute">{formatEuro(p.price)} &middot; {p.seller.sellerName ?? p.seller.displayName}</p>
          </div>
          <label className="flex items-center gap-2 select-none" title="In der Demo nicht änderbar">
            <input type="checkbox" checked={p.posVisible} disabled className="accent-accent opacity-60" />
            <span className={`text-xs font-bold whitespace-nowrap ${p.posVisible ? "text-green-600" : "text-mute"}`}>POS</span>
          </label>
          <span className={`text-xs font-bold rounded-full px-3 py-1 whitespace-nowrap ${p.posOnly ? "bg-purple-50 text-purple-700" : "bg-gray-50 text-mute"}`}>
            {p.posOnly ? "Nur POS" : "Shop"}
          </span>
          {p.isContainer && (
            <span className="text-xs font-bold rounded-full px-3 py-1 whitespace-nowrap bg-amber-50 text-amber-700">Becher</span>
          )}
          {p.isTopping && (
            <span className="text-xs font-bold rounded-full px-3 py-1 whitespace-nowrap bg-pink-50 text-pink-700">Topping</span>
          )}
          <label className="flex items-center gap-2 select-none" title="In der Demo nicht änderbar">
            <input type="checkbox" checked={p.isActive} disabled className="accent-accent opacity-60" />
            <span className={`text-xs font-bold whitespace-nowrap ${p.isActive ? "text-green-600" : "text-red-500"}`}>
              {p.isActive ? "Aktiv" : "Ausgeblendet"}
            </span>
          </label>
          <span className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-mute">Bearbeiten</span>
        </div>
      ))}
    </div>
  );
}
