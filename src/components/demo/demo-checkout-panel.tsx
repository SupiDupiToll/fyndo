"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/format";
import type { DemoProduct, DemoVariant } from "@/lib/demo-data";

export function DemoCheckoutPanel({ product }: { product: DemoProduct }) {
  const variants = product.kind === "PRODUCT" ? (product.variants ?? []) : [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    () => (variants.length > 0 ? variants[0].id : null),
  );
  const [giftCardCode, setGiftCardCode] = useState("");
  const [gcMessage, setGcMessage] = useState("");
  const [showNotice, setShowNotice] = useState(false);

  const selectedVariant: DemoVariant | null =
    variants.find((v) => v.id === selectedVariantId) ?? null;
  const effectiveAmountCents = selectedVariant?.priceCents ?? product.price;

  function checkGiftCard() {
    if (!giftCardCode.trim()) return;
    setGcMessage("Demo: Hier könnte der Code geprüft werden – ohne echte Funktion.");
  }

  return (
    <>
      <div className="mt-6 rounded-xl border border-line bg-white p-5">
        <label className="text-sm font-bold text-ink mb-2 block">Gutscheincode einlösen (optional)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={giftCardCode}
            onChange={(e) => { setGiftCardCode(e.target.value); setGcMessage(""); }}
            placeholder="FYNDO-XXXX-XXXX"
            className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={checkGiftCard}
            disabled={!giftCardCode.trim()}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            Prüfen
          </button>
        </div>
        {gcMessage && <p className="mt-2 text-sm text-mute">{gcMessage}</p>}
      </div>

      {variants.length > 0 && (
        <div className="mt-8 mb-5">
          <span className="block text-sm font-bold text-ink mb-2">Variante wählen</span>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const active = v.id === selectedVariantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  aria-pressed={active}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-white text-ink hover:border-accent"
                  }`}
                >
                  {v.name}
                  <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-mute"}`}>
                    {formatEuro(v.priceCents)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8">
        <button
          onClick={() => setShowNotice(true)}
          className="flex w-full items-center justify-center rounded-xl bg-accent px-8 py-3.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
        >
          {product.kind === "VOUCHER" ? "Jetzt Gutschein kaufen" : `Jetzt kaufen – ${formatEuro(effectiveAmountCents)}`}
        </button>
        {showNotice && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            <i className="fa-solid fa-flask mr-2" />
            Das ist eine Demo – es wird keine echte Bestellung ausgelöst und keine Zahlung durchgeführt.
          </p>
        )}
        <Link href="/demos/marketplace" className="mt-4 block text-center text-sm font-bold text-mute hover:text-ink transition-colors">
          ← Zurück zum Marktplatz
        </Link>
      </div>
    </>
  );
}
