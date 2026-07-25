"use client";

import { useEffect, useState } from "react";

type TPO = {
  id: string;
  userId: string;
  productUrl: string;
  shopName: string;
  shopHost: string;
  shopFaviconUrl: string | null;
  customerNote: string | null;
  amountCents: number | null;
  adminNote: string | null;
  status: string;
  createdAt: string;
  user: { displayName: string; email: string };
};

const statusLabels: Record<string, string> = {
  REQUESTED: "Anfrage",
  QUOTED: "Preis gesetzt",
  ORDERED: "Bestellt",
  DONE: "Erledigt",
  CANCELLED: "Storniert",
};

const statusColors: Record<string, string> = {
  REQUESTED: "bg-yellow-50 text-yellow-700",
  QUOTED: "bg-blue-50 text-blue-700",
  ORDERED: "bg-purple-50 text-purple-700",
  DONE: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-50 text-gray-500",
};

export default function AdminConciergePage() {
  const [orders, setOrders] = useState<TPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function loadOrders() {
    setLoading(true);
    fetch("/api/third-party-orders")
      .then((r) => r.json())
      .then((data) => setOrders(data))
      .catch(() => setError("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }

  // We need a GET endpoint that returns all orders for admin
  // The current route.ts only has POST. Let me use a query param approach.
  useEffect(() => {
    loadOrders();
  }, []);

  async function handleSave(id: string, currentStatus: string) {
    setSaving(true); setError("");
    const body: Record<string, unknown> = {};

    if (amount) {
      body.amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      if (currentStatus === "REQUESTED") body.status = "QUOTED";
    }
    if (adminNote) body.adminNote = adminNote;

    try {
      const res = await fetch(`/api/third-party-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Fehler"); return; }
      setEdit(null); setAmount(""); setAdminNote("");
      loadOrders();
    } catch {
      setError("Fehler beim Speichern");
    } finally { setSaving(false); }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setSaving(true);
    try {
      await fetch(`/api/third-party-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      loadOrders();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  if (loading) return <div className="text-mute">Lade...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Concierge</h1>
        <p className="text-mute mt-1">Drittshop-Anfragen verwalten.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-mute">Keine Anfragen.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {o.shopFaviconUrl && <img src={o.shopFaviconUrl} alt="" className="h-6 w-6 rounded" />}
                  <div>
                    <p className="font-bold">{o.shopName}</p>
                    <p className="text-xs text-mute">{o.shopHost}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold rounded-full px-3 py-1 ${statusColors[o.status] ?? ""}`}>
                  {statusLabels[o.status] ?? o.status}
                </span>
              </div>

              <div className="text-sm space-y-1 mb-3">
                <p>
                  <span className="text-mute">Link:</span>{" "}
                  <a href={o.productUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{o.productUrl.length > 60 ? o.productUrl.slice(0, 60) + "..." : o.productUrl}</a>
                </p>
                <p><span className="text-mute">Kunde:</span> {o.user.displayName} ({o.user.email})</p>
                {o.customerNote && <p><span className="text-mute">Hinweis:</span> {o.customerNote}</p>}
                {o.amountCents && <p><span className="text-mute">Preis:</span> {(o.amountCents / 100).toFixed(2).replace(".", ",")}€</p>}
                {o.adminNote && <p><span className="text-mute">Admin:</span> {o.adminNote}</p>}
                <p className="text-xs text-mute">{new Date(o.createdAt).toLocaleDateString("de-DE")}</p>
              </div>

              {edit === o.id ? (
                <div className="space-y-3 border-t border-line pt-3 mt-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-mute mb-1">Preis (€)</label>
                      <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-line px-4 py-2 text-sm outline-none focus:border-accent" placeholder="0,00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-mute mb-1">Admin-Notiz</label>
                    <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} className="w-full rounded-lg border border-line px-4 py-2 text-sm outline-none focus:border-accent resize-none" placeholder="Interne Notiz..." />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(o.id, o.status)} disabled={saving} className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                      {saving ? "..." : "Speichern"}
                    </button>
                    <button onClick={() => setEdit(null)} className="rounded-lg border border-line px-5 py-2 text-sm font-bold hover:bg-surf">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 border-t border-line pt-3 mt-3">
                  <button onClick={() => { setEdit(o.id); setAmount(o.amountCents ? (o.amountCents / 100).toFixed(2).replace(".", ",") : ""); setAdminNote(o.adminNote ?? ""); }}
                    className="rounded-lg border border-line px-4 py-2 text-sm font-bold hover:bg-surf transition-colors">
                    Bearbeiten
                  </button>

                  {o.status === "QUOTED" && (
                    <button onClick={() => handleStatusChange(o.id, "ORDERED")} disabled={saving}
                      className="rounded-lg bg-purple-50 text-purple-700 px-4 py-2 text-sm font-bold hover:bg-purple-100 transition-colors disabled:opacity-50">
                      Bestellt
                    </button>
                  )}
                  {o.status === "ORDERED" && (
                    <button onClick={() => handleStatusChange(o.id, "DONE")} disabled={saving}
                      className="rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm font-bold hover:bg-green-100 transition-colors disabled:opacity-50">
                      Erledigt
                    </button>
                  )}
                  {o.status !== "CANCELLED" && o.status !== "DONE" && (
                    <button onClick={() => handleStatusChange(o.id, "CANCELLED")} disabled={saving}
                      className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-4 py-2 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50 ml-auto">
                      Stornieren
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
