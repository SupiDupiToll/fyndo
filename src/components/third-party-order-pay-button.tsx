"use client";

import { useState } from "react";

export function ThirdPartyOrderPayButton({ thirdPartyOrderId }: { thirdPartyOrderId: string }) {
  const [giftCardCode, setGiftCardCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/third-party-orders/${thirdPartyOrderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftCardCode: giftCardCode || undefined }),
      });

      const data = (await response.json()) as { error?: string; paymentUrl?: string; paid?: boolean; message?: string };

      if (!response.ok) {
        setError(data.error ?? "Zahlung konnte nicht gestartet werden.");
        return;
      }

      if (data.paid) {
        window.location.href = `/bestellungen/complete?thirdPartyOrderId=${thirdPartyOrderId}`;
        return;
      }

      if (!data.paymentUrl) {
        setError("Zahlung konnte nicht gestartet werden.");
        return;
      }

      window.location.href = data.paymentUrl;
    } catch {
      setError("Zahlung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={giftCardCode}
        onChange={(e) => setGiftCardCode(e.target.value)}
        placeholder="Gutscheincode (optional)"
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
      />
      <button
        onClick={() => void handlePay()}
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Wird weitergeleitet..." : "Mit RBank bezahlen"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
