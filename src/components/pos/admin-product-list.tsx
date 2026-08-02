"use client";

import Link from "next/link";
import { useState } from "react";
import { formatEuro } from "@/lib/format";

type ProductRow = {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  posVisible: boolean;
  ordersCount: number;
  sellerLabel?: string;
  showSeller?: boolean;
};

export function ProductListAdmin({ products, showSeller }: { products: ProductRow[]; showSeller: boolean }) {
  const [rows, setRows] = useState(products);

  async function togglePosVisible(id: string, current: boolean) {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, posVisible: !current } : p)));
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posVisible: !current }),
      });
      if (!res.ok) throw new Error("Fehler");
    } catch {
      setRows((prev) => prev.map((p) => (p.id === id ? { ...p, posVisible: current } : p)));
    }
  }

  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <div key={p.id} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-tile">
            {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-2" /> : <div className="flex h-full items-center justify-center text-xs text-mute">Bild</div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{p.title}</p>
            <p className="text-sm text-mute">{formatEuro(p.price)} &middot; {p.ordersCount} Bestellungen</p>
            {showSeller && p.sellerLabel && <p className="text-xs text-mute">{p.sellerLabel}</p>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none" title="Im POS-Kiosk anzeigen">
            <input
              type="checkbox"
              checked={p.posVisible}
              onChange={() => void togglePosVisible(p.id, p.posVisible)}
              className="accent-accent"
            />
            <span className={`text-xs font-bold whitespace-nowrap ${p.posVisible ? "text-green-600" : "text-mute"}`}>
              POS
            </span>
          </label>
          <span className={`text-xs font-bold rounded-full px-3 py-1 ${p.isActive ? "bg-green-50 text-green-700" : "bg-gray-50 text-mute"}`}>
            {p.isActive ? "Aktiv" : "Inaktiv"}
          </span>
          <Link href={`/admin/products/${p.id}/edit`} className="rounded-lg border border-line px-4 py-2 text-sm font-bold hover:bg-surf transition-colors">
            Bearbeiten
          </Link>
        </div>
      ))}
    </div>
  );
}
