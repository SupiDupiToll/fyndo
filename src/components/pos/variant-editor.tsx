"use client";

import { useState } from "react";

export type VariantRow = { id: string; name: string; price: string };

export function VariantEditor({
  initial,
  onChange,
}: {
  initial: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
}) {
  const [variants, setVariants] = useState<VariantRow[]>(initial);

  function update(next: VariantRow[]) {
    setVariants(next);
    onChange(next);
  }

  function add() {
    update([...variants, { id: `v${Math.random().toString(36).slice(2, 8)}`, name: "", price: "" }]);
  }

  function remove(id: string) {
    update(variants.filter((v) => v.id !== id));
  }

  function setRow(id: string, patch: Partial<VariantRow>) {
    update(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="block text-sm font-bold">Varianten</label>
          <p className="text-xs text-mute mt-0.5">Z. B. Größen (Klein/Mittel/Groß) mit eigenem Preis</p>
        </div>
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-accent hover:bg-surf transition-colors"
        >
          + Variante
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-mute py-2">Keine Varianten. Das Produkt wird direkt mit dem Basispreis verkauft.</p>
      ) : (
        <div className="space-y-2">
          {variants.map((v) => (
            <div key={v.id} className="flex items-center gap-3">
              <input
                value={v.name}
                onChange={(e) => setRow(v.id, { name: e.target.value })}
                placeholder="Name (z. B. Klein)"
                className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 outline-none focus:border-accent transition-colors"
              />
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mute text-sm">€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={v.price}
                  onChange={(e) => setRow(v.id, { price: e.target.value })}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-line bg-white pl-7 pr-3 py-2.5 outline-none focus:border-accent transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(v.id)}
                className="w-9 h-9 shrink-0 rounded-lg border border-line text-mute hover:text-red-600 hover:border-red-200 transition-colors"
                aria-label="Variante entfernen"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function variantRowsToPayload(rows: VariantRow[]) {
  return rows
    .filter((v) => v.name.trim())
    .map((v) => ({
      id: v.id,
      name: v.name.trim(),
      priceCents: Math.round((parseFloat(v.price) || 0) * 100),
    }));
}
