"use client";

import { useUser, useHexclaveApp } from "@hexclave/next";
import { createPortal } from "react-dom";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RabattSection } from "@/components/rabatt-section";

type ShopPreview = {
  canonicalUrl: string;
  faviconUrl: string;
  shopHost: string;
  shopName: string;
};

function ConciergeForm() {
  const user = useUser();
  const app = useHexclaveApp();
  const searchParams = useSearchParams();
  const [productUrl, setProductUrl] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [options, setOptions] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [preview, setPreview] = useState<ShopPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) setProductUrl(urlParam);
  }, [searchParams]);

  function buildNote(): string {
    const parts: string[] = [`Menge: ${quantity}`];
    if (options.trim()) parts.push(`Optionen: ${options.trim()}`);
    if (estimatedPrice.trim()) parts.push(`Geschätzter Preis: ${estimatedPrice.trim()}€`);
    return parts.join(" | ");
  }

  async function loadPreview() {
    const trimmedUrl = productUrl.trim();
    if (!trimmedUrl) { setError("Bitte einen Produkt-Link angeben."); return; }
    if (!user) { app.redirectToSignIn(); return; }

    setLoadingPreview(true); setError(""); setMessage("");

    try {
      const response = await fetch(`/api/third-party-orders/preview?url=${encodeURIComponent(trimmedUrl)}`, { cache: "no-store" });
      const data = (await response.json()) as Partial<ShopPreview> & { error?: string };

      if (!response.ok || !data.shopName || !data.shopHost) {
        setError(data.error ?? "Shop-Vorschau konnte nicht geladen werden.");
        return;
      }

      setPreview(data as ShopPreview);
    } catch {
      setError("Shop-Vorschau konnte nicht geladen werden.");
    } finally { setLoadingPreview(false); }
  }

  async function submitOrder() {
    if (!preview) return;
    setLoadingSubmit(true); setError("");

    try {
      const response = await fetch("/api/third-party-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productUrl: productUrl.trim(), customerNote: buildNote() }),
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) { setError(data.error ?? "Bestellung konnte nicht erstellt werden."); return; }

      setMessage(data.message ?? "Anfrage wurde gesendet.");
      setPreview(null);
      setProductUrl(""); setQuantity(1); setOptions(""); setEstimatedPrice("");
    } catch {
      setError("Bestellung konnte nicht erstellt werden.");
    } finally { setLoadingSubmit(false); }
  }

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); void loadPreview(); }} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-ink mb-2">Produkt-Link (URL)</label>
          <input
            type="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://shop.example.com/produkt/..."
            className="w-full bg-white border border-line rounded-xl px-5 py-4 outline-none focus:border-accent transition-colors text-lg"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-ink mb-2">Menge</label>
            <input
              type="number"
              value={quantity}
              min={1}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-full bg-white border border-line rounded-xl px-5 py-4 outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-2">Geschätzter Preis (optional)</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-mute font-medium">€</span>
              <input
                type="text"
                value={estimatedPrice}
                onChange={(e) => setEstimatedPrice(e.target.value)}
                placeholder="0,00"
                className="w-full bg-white border border-line rounded-xl pl-10 pr-5 py-4 outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-ink mb-2">Optionen (Größe, Farbe, etc.)</label>
          <textarea
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="z.B. Größe: L, Farbe: Schwarz, Modell: 2024"
            rows={3}
            className="w-full bg-white border border-line rounded-xl px-5 py-4 outline-none focus:border-accent transition-colors resize-none"
          />
        </div>

        <div className="bg-accent/5 border border-accent/20 rounded-xl p-6 flex items-start gap-4">
          <i className="fa-solid fa-circle-info text-accent mt-0.5"></i>
          <div>
            <p className="text-sm font-bold text-ink mb-1">Was passiert als nächstes?</p>
            <p className="text-sm text-mute leading-relaxed">
              Unser Team prüft den Link und sendet dir innerhalb von 2-4 Stunden ein Angebot per E-Mail.
            </p>
          </div>
        </div>

        {!user && (
          <button
            type="button"
            onClick={() => app.redirectToSignIn()}
            className="w-full bg-accent text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors"
          >
            Einloggen und fortfahren
          </button>
        )}

        {user && (
          <button
            type="submit"
            disabled={loadingPreview || !productUrl.trim()}
            className="w-full bg-accent text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loadingPreview ? "Shop wird geprüft..." : "Shop prüfen"}
          </button>
        )}
      </form>

      {message && <p className="mt-6 text-center text-green-600 font-semibold">{message}</p>}
      {error && <p className="mt-6 text-center text-red-600">{error}</p>}

      <div className="border-t border-line my-16" />

      <section className="mb-12">
        <div className="flex items-start gap-4 mb-8 bg-accent/5 border border-accent/20 rounded-2xl p-6">
          <i className="fa-solid fa-percent text-accent text-xl mt-0.5"></i>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Exklusive Cashback-Rabatte</h2>
            <p className="text-mute text-sm mt-1">
              Bestellst du ein Produkt aus einem dieser Shops über den Concierge-Service, erhältst du den angegebenen Cashback-Rabatt. Einfach Link einfügen, bestellen & sparen.
            </p>
          </div>
        </div>
        <RabattSection />
      </section>

      {preview && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setPreview(null); }}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Shop bestätigen</h3>
              <button onClick={() => { setPreview(null); }} className="text-mute hover:text-ink text-xl">&times;</button>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-surf p-4 mb-4">
              {preview.faviconUrl && <img src={preview.faviconUrl} alt="" className="h-8 w-8 rounded" />}
              <div>
                <p className="font-bold">{preview.shopName}</p>
                <p className="text-sm text-mute">{preview.shopHost}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-mute mb-6">
              <p><span className="font-semibold text-ink">Link:</span> {productUrl.length > 60 ? productUrl.slice(0, 60) + "..." : productUrl}</p>
              <p><span className="font-semibold text-ink">Menge:</span> {quantity}</p>
              {options && <p><span className="font-semibold text-ink">Optionen:</span> {options}</p>}
              {estimatedPrice && <p><span className="font-semibold text-ink">Geschätzter Preis:</span> {estimatedPrice}€</p>}
            </div>

            <p className="text-sm text-mute mb-6">
              Der Admin wird benachrichtigt und setzt einen Preis. Du bekommst Bescheid, sobald du bezahlen kannst.
            </p>

            <div className="flex gap-3">
              <button onClick={() => { setPreview(null); }} className="flex-1 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink hover:bg-surf transition-colors">
                Abbrechen
              </button>
              <button onClick={() => void submitOrder()} disabled={loadingSubmit} className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                {loadingSubmit ? "Sende..." : "Ja, bestätigen"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function ConciergePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Concierge Service</h1>
        <p className="text-mute mt-3 leading-relaxed">
          In einem anderen Shop fündig geworden? Einfach Link einfügen, Menge und Optionen angeben – wir bestellen für dich.
        </p>
      </div>
      <Suspense fallback={<p className="text-mute">Lade...</p>}>
        <ConciergeForm />
      </Suspense>
    </main>
  );
}
