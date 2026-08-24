"use client";

import { useEffect, useRef, useState } from "react";
import { formatEuro } from "@/lib/format";
import {
  parsePosSettings,
  POS_SETTINGS_DEFAULTS,
  type PosLockMedia,
  type PosSettings,
} from "@/lib/pos-settings";

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
  items: { title: string; variantName: string | null; containerName: string | null; amountCents: number; qty: number }[];
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

export function PosAdminDashboard({ vendorName }: { vendorName: string }) {
  const [groups, setGroups] = useState<PosGroup[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [lockSettings, setLockSettings] = useState<PosSettings>({ ...POS_SETTINGS_DEFAULTS });
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState("");
  const [lockSaved, setLockSaved] = useState(false);
  const [orderSoundOn, setOrderSoundOn] = useState(true);
  const seenGroupsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("fyndo-pos-admin-sound");
    if (stored !== null) setOrderSoundOn(stored === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("fyndo-pos-admin-sound", orderSoundOn ? "1" : "0");
  }, [orderSoundOn]);

  useEffect(() => {
    if (!showAll) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowAll(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showAll]);

  function playChime() {
    if (!orderSoundOn || typeof window === "undefined") return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const notes: [number, number][] = [
        [880, 0],
        [1318.51, 0.14],
      ];
      for (const [freq, t] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.14, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.6);
      }
      window.setTimeout(() => void ctx.close(), 1200);
    } catch {
      // audio not available, skip
    }
  }

  function speakDynamic(text: string) {
    if (!orderSoundOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const german = voices.find((v) => v.lang.toLowerCase().startsWith("de")) ?? null;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = 1.05;
    if (german) utterance.voice = german;
    window.speechSynthesis.speak(utterance);
  }

  function alertNewOrder(group: PosGroup) {
    playChime();
    const parts: string[] = [];
    if (group.posOrderNumber != null) parts.push(`Neue Bestellung Nummer ${group.posOrderNumber}.`);
    else parts.push("Neue Bestellung.");
    if (group.quantity > 1) parts.push(`${group.quantity} Artikel.`);
    else parts.push("1 Artikel.");
    parts.push(`${formatEuro(group.totalCents)}.`);
    speakDynamic(parts.join(" "));
  }

  async function loadLockSettings() {
    try {
      const res = await fetch(`/api/pos/settings?vendor=${encodeURIComponent(vendorName)}`);
      if (!res.ok) return;
      setLockSettings(parsePosSettings(await res.json()));
    } catch {
      // ignore, defaults stay
    }
  }

  async function saveLockSettings() {
    setLockBusy(true);
    setLockError("");
    setLockSaved(false);
    try {
      const res = await fetch("/api/pos/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lockSettings, vendor: vendorName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLockError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setLockSettings(parsePosSettings(data));
      setLockSaved(true);
      window.setTimeout(() => setLockSaved(false), 2500);
    } catch {
      setLockError("Speichern fehlgeschlagen.");
    } finally {
      setLockBusy(false);
    }
  }

  function setLockMedia(media: PosLockMedia[]) {
    setLockSettings((s) => ({ ...s, media }));
  }

  function updateLockMedia(index: number, patch: Partial<PosLockMedia>) {
    setLockMedia(lockSettings.media.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function moveLockMedia(index: number, dir: -1 | 1) {
    const next = [...lockSettings.media];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLockMedia(next);
  }

  async function load() {
    try {
      const res = await fetch("/api/pos/groups?scope=all");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setGroups(data);
      setError("");

      if (!seededRef.current) {
        seededRef.current = true;
        seenGroupsRef.current = new Set(data.map((g: PosGroup) => g.posGroupId));
        return;
      }

      for (const group of data as PosGroup[]) {
        if (group.status !== "PENDING") continue;
        if (seenGroupsRef.current.has(group.posGroupId)) continue;
        seenGroupsRef.current.add(group.posGroupId);
        alertNewOrder(group);
      }
    } catch {
      setError("POS-Bestellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
    void loadLockSettings();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const pendingGroups = groups.filter((g) => g.status === "PENDING");
  const paidGroups = groups.filter((g) => g.status === "PAID");
  const paidTotal = paidGroups.reduce((s, g) => s + g.totalCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">POS-Kasse</h1>
          <p className="text-sm text-mute mt-1">{vendorName}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <a
            href={`/pos/${encodeURIComponent(vendorName)}/board`}
            className="flex items-center gap-2 rounded-xl bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-ink/90 transition-colors"
            title="Bestellübersicht (Board) als Vollbild öffnen"
          >
            <i className="fa-solid fa-tv" />
            <span className="hidden md:inline">Bestellübersicht</span>
          </a>
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink hover:bg-surf transition-colors"
            title="Alle Bestellungen in einem Popup anzeigen"
          >
            <i className="fa-solid fa-list" />
            <span className="hidden md:inline">Alle anzeigen</span>
            <span className="flex items-center justify-center min-w-5 h-5 rounded-full bg-accent/10 px-1.5 text-xs font-black text-accent tabular-nums">
              {groups.length}
            </span>
          </button>
          <button
            onClick={() => setOrderSoundOn((s) => !s)}
            className={`h-10 w-10 rounded-xl border flex items-center justify-center text-lg transition-colors ${orderSoundOn ? "border-accent text-accent" : "border-line text-mute"}`}
            aria-label={orderSoundOn ? "Ton aus" : "Ton an"}
            title={orderSoundOn ? "Ton bei neuer Bestellung aus" : "Ton bei neuer Bestellung an"}
          >
            <i className={`${orderSoundOn ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Zu bestätigen</p>
          <p className="text-3xl font-bold mt-1">{pendingGroups.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Bezahlt – in Bearbeitung</p>
          <p className="text-3xl font-bold mt-1">{paidGroups.length}</p>
          <p className="text-xs text-mute mt-0.5">Summe {formatEuro(paidTotal)}</p>
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <ColumnHeader
              title="Zu bestätigen"
              subtitle="noch nicht bezahlt"
              count={pendingGroups.length}
              dotClass="bg-yellow-500"
              textClass="text-yellow-700"
            />
            <div className="mt-3 space-y-3">
              {pendingGroups.length === 0 ? (
                <EmptyState text="Keine unbezahlten Bestellungen." />
              ) : (
                pendingGroups.map((group) => (
                  <OrderCard
                    key={group.posGroupId}
                    group={group}
                    busyId={busyId}
                    method={methods[group.posGroupId] ?? group.method ?? "CASH"}
                    onMethodChange={(m) => setMethods((prev) => ({ ...prev, [group.posGroupId]: m }))}
                    onConfirm={() => void confirm(group)}
                    onFulfill={() => void fulfill(group)}
                    onCancel={() => void cancel(group)}
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <ColumnHeader
              title="In Bearbeitung"
              subtitle="bezahlt, noch nicht ausgeführt"
              count={paidGroups.length}
              dotClass="bg-green-600"
              textClass="text-green-700"
            />
            <div className="mt-3 space-y-3">
              {paidGroups.length === 0 ? (
                <EmptyState text="Keine bezahlten Bestellungen in Bearbeitung." />
              ) : (
                paidGroups.map((group) => (
                  <OrderCard
                    key={group.posGroupId}
                    group={group}
                    busyId={busyId}
                    method={methods[group.posGroupId] ?? group.method ?? "CASH"}
                    onMethodChange={(m) => setMethods((prev) => ({ ...prev, [group.posGroupId]: m }))}
                    onConfirm={() => void confirm(group)}
                    onFulfill={() => void fulfill(group)}
                    onCancel={() => void cancel(group)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {showAll && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-line shrink-0">
              <h2 className="text-xl font-bold tracking-tight">
                Alle Bestellungen{" "}
                <span className="text-mute text-base font-medium">({groups.length})</span>
              </h2>
              <button
                onClick={() => setShowAll(false)}
                className="h-10 w-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
                aria-label="Schließen"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {groups.length === 0 ? (
                <EmptyState text="Keine Bestellungen vorhanden." />
              ) : (
                [...groups]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((group) => (
                    <OrderCard
                      key={group.posGroupId}
                      group={group}
                      busyId={busyId}
                      method={methods[group.posGroupId] ?? group.method ?? "CASH"}
                      onMethodChange={(m) => setMethods((prev) => ({ ...prev, [group.posGroupId]: m }))}
                      onConfirm={() => void confirm(group)}
                      onFulfill={() => void fulfill(group)}
                      onCancel={() => void cancel(group)}
                    />
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Lock-Screen</h2>
            <p className="text-sm text-mute mt-1">
              Vollbild-Attraktionsbildschirm mit Bildern/Videos, der beim Öffnen, nach einer
              Bestellung und bei Inaktivität angezeigt wird.
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm font-bold">
            <span className={lockSettings.lockScreenEnabled ? "text-accent" : "text-mute"}>
              {lockSettings.lockScreenEnabled ? "Aktiv" : "Aus"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={lockSettings.lockScreenEnabled}
              onClick={() =>
                setLockSettings((s) => ({ ...s, lockScreenEnabled: !s.lockScreenEnabled }))
              }
              className={`relative h-8 w-14 rounded-full transition-colors ${lockSettings.lockScreenEnabled ? "bg-accent" : "bg-tile"}`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${lockSettings.lockScreenEnabled ? "left-7" : "left-1"}`}
              />
            </button>
          </label>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <label className="block rounded-xl border border-line p-4">
            <span className="text-xs font-bold text-mute uppercase tracking-wider">
              Inaktivität (Sekunden)
            </span>
            <input
              type="number"
              min={5}
              max={600}
              value={lockSettings.idleTimeoutSeconds}
              onChange={(e) =>
                setLockSettings((s) => ({
                  ...s,
                  idleTimeoutSeconds: Math.max(5, Math.round(Number(e.target.value) || POS_SETTINGS_DEFAULTS.idleTimeoutSeconds)),
                }))
              }
              className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold outline-none"
            />
            <span className="mt-1 block text-xs text-mute">Nach dieser Zeit ohne Bedienung.</span>
          </label>

          <label className="block rounded-xl border border-line p-4">
            <span className="text-xs font-bold text-mute uppercase tracking-wider">
              Auto-Lock nach Bestellung (Sekunden)
            </span>
            <input
              type="number"
              min={0}
              max={120}
              value={lockSettings.successAutoLockSeconds}
              onChange={(e) =>
                setLockSettings((s) => ({
                  ...s,
                  successAutoLockSeconds: Math.max(0, Math.round(Number(e.target.value) || 0)),
                }))
              }
              className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold outline-none"
            />
            <span className="mt-1 block text-xs text-mute">
              Erfolgs-Screen danach automatisch sperren (0 = nur über Button).
            </span>
          </label>

          <div className="rounded-xl border border-line p-4">
            <span className="text-xs font-bold text-mute uppercase tracking-wider">
              Beim Öffnen anzeigen
            </span>
            <label className="mt-2 flex items-center gap-3 text-sm font-bold">
              <button
                type="button"
                role="switch"
                aria-checked={lockSettings.showOnLoad}
                onClick={() => setLockSettings((s) => ({ ...s, showOnLoad: !s.showOnLoad }))}
                className={`relative h-8 w-14 rounded-full transition-colors ${lockSettings.showOnLoad ? "bg-accent" : "bg-tile"}`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${lockSettings.showOnLoad ? "left-7" : "left-1"}`}
                />
              </button>
              <span>{lockSettings.showOnLoad ? "Ja" : "Nein"}</span>
            </label>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold text-mute uppercase tracking-wider">Hintergrund-Medien</h3>
          <p className="mt-1 text-xs text-mute">
            Bilder und Videos werden im Wechsel mit Überblendung angezeigt. Ohne Medien erscheint ein
            Branding-Hintergrund.
          </p>

          {lockSettings.media.length === 0 ? (
            <p className="mt-4 text-sm text-mute">Noch keine Medien hinzugefügt.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {lockSettings.media.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-line p-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => moveLockMedia(index, -1)}
                      disabled={index === 0}
                      className="h-9 w-9 rounded-lg border border-line flex items-center justify-center text-mute hover:bg-surf disabled:opacity-30 transition-colors"
                      aria-label="Nach oben"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveLockMedia(index, 1)}
                      disabled={index === lockSettings.media.length - 1}
                      className="h-9 w-9 rounded-lg border border-line flex items-center justify-center text-mute hover:bg-surf disabled:opacity-30 transition-colors"
                      aria-label="Nach unten"
                    >
                      ↓
                    </button>
                  </div>
                  <select
                    value={item.type}
                    onChange={(e) => updateLockMedia(index, { type: e.target.value as PosLockMedia["type"] })}
                    className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold outline-none"
                    aria-label="Medientyp"
                  >
                    <option value="image">Bild</option>
                    <option value="video">Video</option>
                  </select>
                  <input
                    type="url"
                    value={item.url}
                    onChange={(e) => updateLockMedia(index, { url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={() => setLockMedia(lockSettings.media.filter((_, i) => i !== index))}
                    className="h-9 w-9 rounded-lg border border-line flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                    aria-label="Entfernen"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setLockMedia([...lockSettings.media, { type: "image", url: "" }])}
            className="mt-4 rounded-xl border border-line px-4 py-2 text-sm font-bold text-accent hover:bg-surf transition-colors"
          >
            <i className="fa-solid fa-plus mr-1.5" />
            Medien hinzufügen
          </button>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={() => void saveLockSettings()}
            disabled={lockBusy}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {lockBusy ? "Speichert…" : "Speichern"}
          </button>
          {lockSaved && (
            <span className="text-sm font-bold text-green-600">
              <i className="fa-solid fa-check mr-1" />
              Gespeichert
            </span>
          )}
          {lockError && <span className="text-sm font-bold text-red-500">{lockError}</span>}
        </div>
      </section>
    </div>
  );
}

function ColumnHeader({
  title,
  subtitle,
  count,
  dotClass,
  textClass,
}: {
  title: string;
  subtitle: string;
  count: number;
  dotClass: string;
  textClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-3">
      <div className="min-w-0">
        <h2 className={`flex items-center gap-2 text-sm font-black uppercase tracking-widest ${textClass}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
          {title}
        </h2>
        <p className="text-[11px] text-mute mt-0.5">{subtitle}</p>
      </div>
      <span className="flex items-center justify-center min-w-8 h-8 rounded-full bg-tile px-2 text-sm font-black tabular-nums">
        {count}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-10 text-center text-sm text-mute">
      {text}
    </div>
  );
}

function OrderCard({
  group,
  busyId,
  method,
  onMethodChange,
  onConfirm,
  onFulfill,
  onCancel,
}: {
  group: PosGroup;
  busyId: string | null;
  method: string;
  onMethodChange: (method: string) => void;
  onConfirm: () => void;
  onFulfill: () => void;
  onCancel: () => void;
}) {
  const time = new Date(group.createdAt);
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
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
            {(() => {
              const itemGroups: { name: string | null; items: typeof group.items }[] = [];
              for (const item of group.items) {
                const existing = itemGroups.find((g) => g.name === item.containerName);
                if (existing) existing.items.push(item);
                else itemGroups.push({ name: item.containerName, items: [item] });
              }
              return itemGroups.map((ig, igIdx) => (
                <div key={igIdx}>
                  {ig.name && (
                    <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-accent">
                      {ig.name}
                    </p>
                  )}
                  {ig.items.map((item, idx) => (
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
              ));
            })()}
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
                value={method}
                onChange={(e) => onMethodChange(e.target.value)}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink outline-none"
              >
                <option value="CASH">Bar</option>
                <option value="TERMINAL">Kartenterminal</option>
                <option value="TIPPIE">QR (PayPal/Apple Pay/Karte)</option>
                <option value="RBANK">RBank</option>
              </select>
              <button
                onClick={onConfirm}
                disabled={busyId === group.posGroupId}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Bezahlt ✓
              </button>
              <button
                onClick={onCancel}
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
                onClick={onFulfill}
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
}
