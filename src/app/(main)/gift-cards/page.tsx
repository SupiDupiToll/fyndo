"use client";

import { useUser, useHexclaveApp } from "@hexclave/next";
import { useState } from "react";
import { formatEuro } from "@/lib/format";

const AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

export default function GiftCardsPage() {
  const user = useUser();
  const app = useHexclaveApp();
  const [selected, setSelected] = useState(2500);
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
        body: JSON.stringify({ amountCents: selected, message: message.trim() || undefined }),
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
          <div className="grid grid-cols-3 gap-3">
            {AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => setSelected(amount)}
                className={`rounded-2xl border-2 px-4 py-4 text-center font-bold transition-all ${
                  selected === amount
                    ? "border-accent bg-accent/5 text-accent"
                    : "border-line bg-white text-ink hover:border-accent/30"
                }`}
              >
                <span className="text-lg">{formatEuro(amount)}</span>
              </button>
            ))}
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
          {loading ? "Wird weitergeleitet..." : `${formatEuro(selected)} – Gutschein kaufen`}
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
