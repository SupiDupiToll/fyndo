"use client";

import { useState } from "react";

export function VendorPayoutRequestButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleRequest() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/payout-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json() as { error?: string; message?: string };

      if (!response.ok) {
        setError(data.error ?? "Auszahlung konnte nicht ausgeführt werden.");
        return;
      }

      setMessage(data.message ?? "Auszahlung wurde ausgeführt.");
    } catch {
      setError("Auszahlung konnte nicht ausgeführt werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3 lg:items-end">
      <button
        onClick={() => void handleRequest()}
        disabled={loading}
        className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Wird ausgeführt..." : "Jetzt auszahlen"}
      </button>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
