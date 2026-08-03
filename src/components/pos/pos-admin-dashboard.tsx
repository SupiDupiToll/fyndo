"use client";

import { useEffect, useState } from "react";
import { formatEuro } from "@/lib/format";

type PosGroup = {
  posGroupId: string;
  posConfirmToken: string;
  posOrderNumber: number | null;
  method: string | null;
  status: "PENDING" | "PAID" | "DONE" | "CANCELLED";
  totalCents: number;
  itemCount: number;
  quantity: number;
  createdAt: string;
  items: { title: string; variantName: string | null; amountCents: number; qty: number }[];
};

const METHOD_LABELS: Record<string, string> = {
  RBANK: "RBank",
  TIPPIE: "QR (PayPal/Apple Pay/Karte)",
  TERMINAL: "Kartenterminal",
  CASH: "Bar",
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  DONE: "bg-blue-50 text-blue-700 border-blue-200",
  CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
};

const statusLabels: Record<string, string> = {
  PENDING: "Ausstehend",
  PAID: "Bezahlt",
  DONE: "Ausgeführt",
  CANCELLED: "Storniert",
};

type CardBatch = {
  batchId: string;
  count: number;
  used: number;
  createdAt: string;
  firstNumber: number;
  lastNumber: number;
};

export function PosAdminDashboard({ vendorName }: { vendorName: string }) {
  const [scope, setScope] = useState<"open" | "paid" | "all">("open");
  const [groups, setGroups] = useState<PosGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [batches, setBatches] = useState<CardBatch[]>([]);
  const [cardCount, setCardCount] = useState(30);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState("");

  async function loadBatches() {
    try {
      const res = await fetch(`/api/pos/cards?vendor=${encodeURIComponent(vendorName)}`);
      if (!res.ok) return;
      setBatches(await res.json());
    } catch {
      // ignore, section stays empty
    }
  }

  async function load() {
    try {
      const res = await fetch(`/api/pos/groups?scope=${scope}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setGroups(data);
      setError("");
    } catch {
      setError("POS-Bestellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
    void loadBatches();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function confirm(group: PosGroup) {
    setBusyId(group.posGroupId);
    try {
      const res = await fetch("/api/pos/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: group.posGroupId,
          posConfirmToken: group.posConfirmToken,
          method: methods[group.posGroupId] ?? group.method ?? "CASH",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Bestätigung fehlgeschlagen.");
      }
    } catch {
      setError("Bestätigung fehlgeschlagen.");
    } finally {
      setBusyId(null);
      void load();
    }
  }

  async function fulfill(group: PosGroup) {
    setBusyId(group.posGroupId);
    try {
      const res = await fetch("/api/pos/orders/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: group.posGroupId,
          posConfirmToken: group.posConfirmToken,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Markieren fehlgeschlagen.");
      }
    } catch {
      setError("Markieren fehlgeschlagen.");
    } finally {
      setBusyId(null);
      void load();
    }
  }

  async function cancel(group: PosGroup) {
    setBusyId(group.posGroupId);
    try {
      await fetch("/api/pos/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: group.posGroupId,
          posConfirmToken: group.posConfirmToken,
        }),
      });
    } catch {
      setError("Stornierung fehlgeschlagen.");
    } finally {
      setBusyId(null);
      void load();
    }
  }

  async function createBatch() {
    setCardBusy(true);
    setCardError("");
    try {
      const res = await fetch("/api/pos/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor: vendorName, count: cardCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCardError(data.error ?? "Generierung fehlgeschlagen.");
        return;
      }
      window.open(`/api/pos/cards/${encodeURIComponent(data.batchId)}/pdf`, "_blank");
      await loadBatches();
    } catch {
      setCardError("Generierung fehlgeschlagen.");
    } finally {
      setCardBusy(false);
    }
  }

  const openCount = groups.filter((g) => g.status === "PENDING" || g.status === "DONE").length;
  const paidTotal = groups
    .filter((g) => g.status === "PAID")
    .reduce((s, g) => s + g.totalCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">POS-Kasse</h1>
          <p className="text-sm text-mute mt-1">{vendorName}</p>
        </div>
        <div className="flex gap-2">
          {(["open", "paid", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                scope === s ? "bg-accent text-white" : "border border-line hover:bg-surf"
              }`}
            >
              {s === "open" ? "Offen" : s === "paid" ? "Bezahlt" : "Alle"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Offene Bestellungen</p>
          <p className="text-3xl font-bold mt-1">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Bezahlt (Auswahl)</p>
          <p className="text-3xl font-bold mt-1">{formatEuro(paidTotal)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Live-Aktualisierung</p>
          <p className="text-3xl font-bold mt-1 text-green-600">●</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading && groups.length === 0 ? (
        <div className="text-center py-16 text-mute">Lade Bestellungen…</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-mute">Keine Bestellungen in dieser Ansicht.</div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const time = new Date(group.createdAt);
            return (
              <div key={group.posGroupId} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {group.posOrderNumber && (
                        <span className="inline-flex items-center justify-center min-w-8 h-8 rounded-lg bg-accent text-white px-2 text-sm font-black tabular-nums">
                          #{group.posOrderNumber}
                        </span>
                      )}
                      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[group.status]}`}>
                        {statusLabels[group.status]}
                      </span>
                      {group.method && (
                        <span className="inline-block rounded-full bg-tile px-3 py-1 text-xs font-bold text-mute">
                          {METHOD_LABELS[group.method] ?? group.method}
                        </span>
                      )}
                      <span className="text-xs text-mute">
                        {time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {time.toLocaleDateString("de-DE")}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {group.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-ink truncate">
                            {item.title}
                            {item.variantName && (
                              <span className="text-mute"> ({item.variantName})</span>
                            )}
                            {item.qty > 1 && (
                              <span className="ml-2 inline-flex items-center justify-center min-w-6 h-6 rounded-full bg-accent/10 px-2 text-xs font-bold text-accent tabular-nums">
                                ×{item.qty}
                              </span>
                            )}
                          </span>
                          <span className="text-mute tabular-nums shrink-0">{formatEuro(item.amountCents)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-row lg:flex-col items-center lg:items-end gap-3 lg:gap-2 shrink-0">
                    <div className="lg:text-right">
                      <div className="text-2xl font-black tabular-nums">{formatEuro(group.totalCents)}</div>
                      <div className="text-xs text-mute">{group.quantity} Artikel</div>
                    </div>
                    {group.status === "PENDING" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={methods[group.posGroupId] ?? group.method ?? "CASH"}
                          onChange={(e) => setMethods((m) => ({ ...m, [group.posGroupId]: e.target.value }))}
                          className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink outline-none"
                        >
                          <option value="CASH">Bar</option>
                          <option value="TERMINAL">Kartenterminal</option>
                          <option value="TIPPIE">QR (PayPal/Apple Pay/Karte)</option>
                          <option value="RBANK">RBank</option>
                        </select>
                        <button
                          onClick={() => void confirm(group)}
                          disabled={busyId === group.posGroupId}
                          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          Bezahlt ✓
                        </button>
                        <button
                          onClick={() => void cancel(group)}
                          disabled={busyId === group.posGroupId}
                          className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-mute hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          Stornieren
                        </button>
                      </div>
                    )}
                    {group.status === "PAID" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => void fulfill(group)}
                          disabled={busyId === group.posGroupId}
                          className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                        >
                          Ausgeführt ✓
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Bestellnummern-Karten</h2>
            <p className="text-sm text-mute mt-1">
              Generiert ein PDF mit QR-Karten. Kunden nehmen eine Karte und scannen sie an der Kiosk-Kamera.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={200}
              value={cardCount}
              onChange={(e) => setCardCount(Math.max(1, Math.round(Number(e.target.value) || 30)))}
              className="w-24 rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold outline-none"
              aria-label="Anzahl Karten"
            />
            <button
              onClick={() => void createBatch()}
              disabled={cardBusy}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {cardBusy ? "Generiert…" : "Generieren & PDF"}
            </button>
          </div>
        </div>

        {cardError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{cardError}</div>
        )}

        {batches.length === 0 ? (
          <p className="mt-6 text-sm text-mute">Noch keine Karten generiert.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute uppercase tracking-wider border-b border-line">
                  <th className="pb-2 pr-4">Erstellt</th>
                  <th className="pb-2 pr-4">Nummern</th>
                  <th className="pb-2 pr-4">Verbraucht</th>
                  <th className="pb-2 pr-4">Verfügbar</th>
                  <th className="pb-2 text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.batchId} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4 text-mute">
                      {new Date(batch.createdAt).toLocaleDateString("de-DE")} ·{" "}
                      {new Date(batch.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3 pr-4 font-bold tabular-nums">
                      #{batch.firstNumber} – #{batch.lastNumber}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 tabular-nums">
                        {batch.used}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-600 tabular-nums">
                        {batch.count - batch.used}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => window.open(`/api/pos/cards/${encodeURIComponent(batch.batchId)}/pdf`, "_blank")}
                        className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-accent hover:bg-surf transition-colors"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
