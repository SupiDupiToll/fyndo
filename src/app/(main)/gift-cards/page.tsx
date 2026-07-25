"use client";

import { useUser, useHexclaveApp } from "@hexclave/next";
import { useState } from "react";
import { formatEuro } from "@/lib/format";

export default function GiftCardsPage() {
  const user = useUser();
  const app = useHexclaveApp();
  const [selected, setSelected] = useState(25);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePurchase() {
    if (!user) { app.redirectToSignIn(); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/gift-cards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: selected * 100, message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setError(data.error ?? "Fehler");
      }
    } catch {
      setError("Fehler beim Kauf");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Geschenkgutschein</h1>
        <p className="text-mute mt-3 leading-relaxed">
          Verschenke ein Gutschein – der Empfänger bekommt einen Code per E-Mail und kann ihn beim Checkout einlösen.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-sm font-bold text-ink mb-3 block">Betrag wählen</label>
          <div className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-mute">1 € bis 100 €</p>
              <p className="text-xl font-black text-accent">{formatEuro(selected * 100)}</p>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-mute">Euro</span>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={selected}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isInteger(next)) {
                    setSelected(Math.min(100, Math.max(1, next)));
                  }
                }}
                className="w-24 rounded-xl border border-line bg-surf px-3 py-2 text-sm font-bold outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-ink mb-2 block">Persönliche Nachricht (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Alles Gute! 🎉"
            rows={3}
            className="w-full rounded-xl border border-line bg-white px-5 py-4 outline-none focus:border-accent transition-colors resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={() => void handlePurchase()}
          disabled={loading}
          className="w-full rounded-xl bg-accent py-4 text-base font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Wird weitergeleitet..." : `${formatEuro(selected * 100)} – Gutschein kaufen`}
        </button>

        <div className="rounded-xl bg-surf border border-line p-6 text-sm text-mute space-y-2">
          <p>✓ Der Gutschein-Code wird nach Zahlung per E-Mail verschickt</p>
          <p>✓ Beim Checkout einlösbar – Restbetrag bleibt erhalten</p>
          <p>⛌ Auszahlung des Restbetrags nicht möglich</p>
        </div>
      </div>
    </div>
  );
}
