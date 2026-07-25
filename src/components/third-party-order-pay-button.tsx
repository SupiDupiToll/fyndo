"use client";

import { useState } from "react";

export function ThirdPartyOrderPayButton({ thirdPartyOrderId }: { thirdPartyOrderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/third-party-orders/${thirdPartyOrderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await response.json()) as { error?: string; paymentUrl?: string };

      if (!response.ok || !data.paymentUrl) {
        setError(data.error ?? "Zahlung konnte nicht gestartet werden.");
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
    <div>
      <button
        onClick={() => void handlePay()}
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {loading ? "Wird weitergeleitet..." : "Mit RBank bezahlen"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
