"use client";

import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const [form, setForm] = useState({
    rbankMerchantId: "",
    rbankMerchantSecret: "",
    rbankApiUrl: "https://rbank.wireway.ch",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          rbankMerchantId: data.rbankMerchantId ?? "",
          rbankMerchantSecret: data.rbankMerchantSecret ?? "",
          rbankApiUrl: data.rbankApiUrl ?? "https://rbank.wireway.ch",
        });
      })
      .catch(() => setError("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMessage(""); setError("");

    try {
      const res = await fetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rbankMerchantId: form.rbankMerchantId || null,
          rbankMerchantSecret: form.rbankMerchantSecret || null,
          rbankApiUrl: form.rbankApiUrl || null,
        }),
      });
      const data = await res.json() as { error?: string; success?: boolean };
      if (!res.ok) { setError(data.error ?? "Fehler"); return; }
      setMessage("Zahlungseinstellungen gespeichert.");
    } catch {
      setError("Fehler beim Speichern.");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-mute">Lade...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Zahlungseinstellungen</h1>
      <p className="text-mute mb-8">
        R-Bank-Zugangsdaten für deinen Shop. Zahlungen gehen dann direkt auf dein Konto.
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-bold mb-2">Merchant ID</label>
          <input value={form.rbankMerchantId} onChange={(e) => setForm({ ...form, rbankMerchantId: e.target.value })} className="w-full rounded-xl border border-line bg-white px-5 py-3.5 outline-none font-mono text-sm focus:border-accent transition-colors" placeholder="merchant_..." />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Merchant Secret</label>
          <input value={form.rbankMerchantSecret} onChange={(e) => setForm({ ...form, rbankMerchantSecret: e.target.value })} type="password" className="w-full rounded-xl border border-line bg-white px-5 py-3.5 outline-none font-mono text-sm focus:border-accent transition-colors" placeholder="sec_..." />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">API-URL</label>
          <input value={form.rbankApiUrl} onChange={(e) => setForm({ ...form, rbankApiUrl: e.target.value })} className="w-full rounded-xl border border-line bg-white px-5 py-3.5 outline-none font-mono text-sm focus:border-accent transition-colors" />
        </div>
        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={saving} className="rounded-xl bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? "Speichere..." : "Speichern"}
          </button>
        </div>
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
