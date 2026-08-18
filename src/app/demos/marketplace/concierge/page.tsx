"use client";

import { useState } from "react";

export default function DemoConciergePage() {
  const [productUrl, setProductUrl] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [options, setOptions] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productUrl.trim()) {
      setError("Bitte einen Produkt-Link angeben.");
      setMessage("");
      return;
    }
    setError("");
    setMessage(
      "Demo: Die Shop-Prüfung und Bestellung sind hier deaktiviert. Im Live-Betrieb würde dein Link geprüft und der Shop bestätigt.",
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Concierge Service</h1>
          <p className="text-mute mt-3 leading-relaxed">
            In einem anderen Shop fündig geworden? Einfach Link einfügen, Menge und Optionen angeben – wir bestellen für dich.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink text-white px-3 py-1 text-[11px] font-black uppercase tracking-widest">
          <i className="fa-solid fa-flask" />
          Demo
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-ink mb-2">Produkt-Link (URL)</label>
          <input
            type="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://shop.example.com/produkt/..."
            className="w-full bg-white border border-line rounded-xl px-5 py-4 outline-none focus:border-accent transition-colors text-lg"
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

        <button
          type="submit"
          disabled={!productUrl.trim()}
          className="w-full bg-accent text-white py-4 rounded-xl font-bold text-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          Shop prüfen
        </button>
      </form>

      {message && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{message}</p>}
      {error && <p className="mt-6 text-center text-red-600">{error}</p>}
    </main>
  );
}
