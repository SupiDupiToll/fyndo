"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type BoardStatus = "PENDING" | "PAID" | "DONE" | "CANCELLED";

type RawGroup = {
  posGroupId: string;
  posOrderNumber: number | null;
  status: BoardStatus;
  totalCents: number;
  quantity: number;
  createdAt: string;
  fulfilledAt: string | null;
};

type BoardOrder = RawGroup & {
  side: "left" | "right";
  readyAt: number | null;
  expiresAt: number | null;
  inColumn: boolean;
};

type PopupKind = "new" | "ready";
type QueuedPopup = { order: BoardOrder; kind: PopupKind };

type DemoKioskEntry = {
  posGroupId: string;
  posOrderNumber?: number | null;
  status?: "PAID" | "DONE";
  totalCents?: number;
  quantity?: number;
  createdAt?: string;
  fulfilledAt?: string | null;
};

const POPUP_HOLD_MS = 3200;

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PosOrderBoard({
  vendorName,
  demo = false,
  readyHoldMinutes = 10,
}: {
  vendorName: string;
  demo?: boolean;
  readyHoldMinutes?: number;
}) {
  const holdMs = readyHoldMinutes * 60 * 1000;
  const [orders, setOrders] = useState<Map<string, BoardOrder>>(new Map());
  const [popup, setPopup] = useState<QueuedPopup | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const popupRef = useRef<QueuedPopup | null>(null);
  const queueRef = useRef<QueuedPopup[]>([]);
  const demoNumberRef = useRef(106);

  // ---- clock + expiry tick ----
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const expired = Array.from(ordersRef.current.values()).filter(
      (o) => o.side === "right" && o.expiresAt != null && o.expiresAt <= Date.now(),
    );
    if (expired.length === 0) return;
    setOrders((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const o of expired) {
        if (next.delete(o.posGroupId)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [now]);

  // ---- sound ----
  function playChime(rising: boolean) {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      void ctx.resume?.();
      const t0 = ctx.currentTime;
      const notes = rising
        ? [
            [880, 0],
            [1318.51, 0.14],
          ]
        : [
            [1318.51, 0],
            [880, 0.14],
          ];
      for (const [freq, t] of notes as [number, number][]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t0 + t);
        gain.gain.linearRampToValueAtTime(0.18, t0 + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + t);
        osc.stop(t0 + t + 0.6);
      }
      window.setTimeout(() => void ctx.close(), 1200);
    } catch {
      // audio not available
    }
  }

  function announceOrder(order: BoardOrder, kind: PopupKind) {
    if (!soundOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      const german = voices.find((v) => v.lang.toLowerCase().startsWith("de")) ?? null;
      const utterance = new SpeechSynthesisUtterance(
        order.posOrderNumber != null
          ? kind === "ready"
            ? `Bestellung Nummer ${order.posOrderNumber} ist abholbereit.`
            : `Neue Bestellung Nummer ${order.posOrderNumber}.`
          : kind === "ready"
            ? "Bestellung ist abholbereit."
            : "Neue Bestellung.",
      );
      utterance.lang = "de-DE";
      utterance.rate = 1.05;
      if (german) utterance.voice = german;
      window.speechSynthesis.speak(utterance);
    } catch {
      // speech not available
    }
  }

  // ---- popup queue ----
  function dismissPopup(id: string) {
    setOrders((prev) => {
      const next = new Map(prev);
      const o = next.get(id);
      if (o && !o.inColumn) next.set(id, { ...o, inColumn: true });
      return next;
    });
  }

  const showNextPopup = useCallback(function showNextPopup() {
    if (popupRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    popupRef.current = next;
    setPopup(next);
    playChime(next.kind === "new");
    announceOrder(next.order, next.kind);
    window.setTimeout(() => {
      const id = popupRef.current?.order.posGroupId;
      popupRef.current = null;
      setPopup(null);
      if (id) dismissPopup(id);
      showNextPopup();
    }, POPUP_HOLD_MS);
  }, []);

  const enqueuePopup = useCallback(
    (order: BoardOrder, kind: PopupKind = "new") => {
      queueRef.current.push({ order, kind });
      showNextPopup();
    },
    [showNextPopup],
  );

  // ---- real mode: poll groups ----
  const reconcile = useCallback(
    (groups: RawGroup[], popupNew: boolean) => {
      const next = new Map(ordersRef.current);
      const nowMs = Date.now();
      const seen = new Set<string>();
      const popups: QueuedPopup[] = [];

      for (const g of groups) {
        seen.add(g.posGroupId);
        const existing = next.get(g.posGroupId);
        if (!existing) {
          // Nur bezahlte (PAID) und ausgeführte (DONE) anzeigen – keine unbezahlten
          if (g.status !== "PAID" && g.status !== "DONE") continue;
          const isDone = g.status === "DONE";
          const readyAt = isDone
            ? g.fulfilledAt
              ? new Date(g.fulfilledAt).getTime()
              : nowMs
            : null;
          const expiresAt = readyAt != null ? readyAt + holdMs : null;
          if (expiresAt != null && expiresAt <= nowMs) continue;
          const order: BoardOrder = {
            ...g,
            side: isDone ? "right" : "left",
            readyAt,
            expiresAt,
            inColumn: !popupNew || isDone,
          };
          next.set(g.posGroupId, order);
          if (popupNew) popups.push({ order, kind: isDone ? "ready" : "new" });
        } else if (g.status !== "CANCELLED") {
          const updated: BoardOrder = { ...existing, ...g };
          if (g.status === "DONE" && existing.side !== "right") {
            const readyAt = g.fulfilledAt ? new Date(g.fulfilledAt).getTime() : nowMs;
            updated.side = "right";
            updated.readyAt = readyAt;
            updated.expiresAt = readyAt + holdMs;
            updated.fulfilledAt = g.fulfilledAt ?? new Date(readyAt).toISOString();
            if (popupNew) popups.push({ order: updated, kind: "ready" });
          }
          next.set(g.posGroupId, updated);
        } else {
          next.delete(g.posGroupId);
        }
      }

      for (const id of Array.from(next.keys())) {
        const o = next.get(id)!;
        if (!seen.has(id) && o.side === "left") next.delete(id);
      }

      setOrders(next);
      for (const p of popups) enqueuePopup(p.order, p.kind);
    },
    [holdMs, enqueuePopup],
  );

  useEffect(() => {
    if (demo) return;
    let alive = true;
    let firstLoad = true;
    async function load() {
      try {
        const res = await fetch("/api/pos/groups?scope=all");
        if (!res.ok) return;
        const data = (await res.json()) as RawGroup[];
        if (!alive) return;
        reconcile(data, !firstLoad);
        firstLoad = false;
        setError("");
      } catch {
        setError("Bestellübersicht konnte nicht geladen werden.");
      }
    }
    void load();
    const interval = window.setInterval(() => void load(), 4000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // ---- demo mode: simulate a live shop ----
  useEffect(() => {
    if (!demo) return;
    let alive = true;

    function makeOrder(
      status: "PAID" | "DONE",
      number: number,
      createdAt: number,
      readyAt: number | null,
      inColumn: boolean,
    ): BoardOrder {
      return {
        posGroupId: `demo-${number}-${Math.random().toString(36).slice(2, 8)}`,
        posOrderNumber: number,
        status,
        totalCents: 0,
        quantity: 1,
        createdAt: new Date(createdAt).toISOString(),
        fulfilledAt: readyAt != null ? new Date(readyAt).toISOString() : null,
        side: status === "DONE" ? "right" : "left",
        readyAt,
        expiresAt: readyAt != null ? readyAt + holdMs : null,
        inColumn,
      };
    }

    // seed the board so it looks alive immediately
    const nowMs = Date.now();
    const seeds: BoardOrder[] = [
      makeOrder("PAID", 104, nowMs - 4 * 60 * 1000, null, true),
      makeOrder("PAID", 105, nowMs - 2 * 60 * 1000, null, true),
      makeOrder("DONE", 103, nowMs - 7 * 60 * 1000, nowMs - 60 * 1000, true),
      makeOrder("DONE", 102, nowMs - 8 * 60 * 1000, nowMs - 25 * 1000, true),
    ].filter((o) => o.expiresAt == null || o.expiresAt > nowMs);
    setOrders((prev) => {
      const next = new Map(prev);
      for (const s of seeds) next.set(s.posGroupId, s);
      return next;
    });

    // new orders arrive at the kiosk
    const newTimer = window.setInterval(() => {
      if (!alive) return;
      const order = makeOrder("PAID", demoNumberRef.current++, Date.now(), null, false);
      setOrders((prev) => {
        const next = new Map(prev);
        next.set(order.posGroupId, order);
        return next;
      });
      enqueuePopup(order);
    }, 13000);

    // prepared orders become ready for pickup (ohne Pop-up, um die Demo ruhig zu halten)
    const readyTimer = window.setInterval(() => {
      if (!alive) return;
      const nowMs2 = Date.now();
      const candidates = Array.from(ordersRef.current.values()).filter(
        (o) => o.side === "left" && nowMs2 - new Date(o.createdAt).getTime() > 15000,
      );
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setOrders((prev) => {
        const next = new Map(prev);
        const o = next.get(pick.posGroupId);
        if (!o || o.side !== "left") return prev;
        next.set(pick.posGroupId, {
          ...o,
          status: "DONE",
          side: "right",
          readyAt: nowMs2,
          expiresAt: nowMs2 + holdMs,
          fulfilledAt: new Date(nowMs2).toISOString(),
        });
        return next;
      });
    }, 8000);

    // Bestellungen aus dem Demo-Kiosk (/demos/pos) live übernehmen
    const kioskTimer = window.setInterval(() => {
      if (!alive) return;
      let list: DemoKioskEntry[] = [];
      try {
        list = JSON.parse(window.localStorage.getItem("fyndo-demo-pos-orders") ?? "[]") as DemoKioskEntry[];
      } catch {
        return;
      }
      const existing = ordersRef.current;
      const next = new Map(existing);
      const added: BoardOrder[] = [];
      for (const e of list) {
        if (!e || typeof e.posGroupId !== "string" || next.has(e.posGroupId)) continue;
        const isDone = e.status === "DONE";
        const readyAt = isDone && e.fulfilledAt ? new Date(e.fulfilledAt).getTime() : null;
        const order: BoardOrder = {
          posGroupId: e.posGroupId,
          posOrderNumber: e.posOrderNumber ?? null,
          status: isDone ? "DONE" : "PAID",
          totalCents: e.totalCents ?? 0,
          quantity: e.quantity ?? 1,
          createdAt: e.createdAt ?? new Date().toISOString(),
          fulfilledAt: e.fulfilledAt ?? null,
          side: isDone ? "right" : "left",
          readyAt,
          expiresAt: readyAt != null ? readyAt + holdMs : null,
          inColumn: isDone,
        };
        next.set(order.posGroupId, order);
        if (!isDone) added.push(order);
      }
      if (added.length > 0 || next.size !== existing.size) {
        setOrders(next);
        for (const o of added) enqueuePopup(o);
      }
    }, 2000);

    return () => {
      alive = false;
      window.clearInterval(newTimer);
      window.clearInterval(readyTimer);
      window.clearInterval(kioskTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  function markReady(order: BoardOrder) {
    const current = ordersRef.current.get(order.posGroupId);
    if (!current || current.side !== "left") return;
    const readyAt = Date.now();
    const updated: BoardOrder = {
      ...current,
      status: "DONE",
      side: "right",
      readyAt,
      expiresAt: readyAt + holdMs,
      fulfilledAt: new Date(readyAt).toISOString(),
    };
    setOrders((prev) => {
      const next = new Map(prev);
      const o = next.get(order.posGroupId);
      if (!o || o.side !== "left") return prev;
      next.set(o.posGroupId, updated);
      return next;
    });
    enqueuePopup(updated, "ready");
  }

  const leftOrders = useMemo(
    () =>
      Array.from(orders.values())
        .filter((o) => o.inColumn && o.side === "left")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders],
  );
  const rightOrders = useMemo(
    () =>
      Array.from(orders.values())
        .filter((o) => o.inColumn && o.side === "right")
        .sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0)),
    [orders],
  );

  const clock = new Date(now).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#0b0d14] text-white flex flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 sm:px-8 py-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black tracking-tight truncate">
            {vendorName}
            <span className="text-accent">.</span>{" "}
            <span className="text-white/70 font-bold">Bestellübersicht</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-white/40 truncate">
            In Bearbeitung · Zur Abholung bereit
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {demo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest">
              <i className="fa-solid fa-flask" />
              Demo
            </span>
          )}
          <span className="hidden sm:block text-2xl font-black tabular-nums text-white/80">
            {clock}
          </span>
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              if (next) playChime(true);
            }}
            className={`h-10 w-10 rounded-xl border flex items-center justify-center text-lg transition-colors ${
              soundOn ? "border-accent text-accent" : "border-white/15 text-white/40"
            }`}
            aria-label={soundOn ? "Ton aus" : "Ton an"}
            title={soundOn ? "Ton bei neuer Bestellung aus" : "Ton bei neuer Bestellung an"}
          >
            <i className={`${soundOn ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}`} />
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-5 sm:mx-8 mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6 min-h-0">
        <OrderColumn
          title="In Bearbeitung"
          icon="fa-solid fa-fire-burner"
          accentClass="text-amber-400"
          barClass="bg-amber-400"
          orders={leftOrders}
          interactive={demo}
          onMarkReady={markReady}
        />
        <OrderColumn
          title="Zur Abholung bereit"
          icon="fa-solid fa-bell-concierge"
          accentClass="text-emerald-400"
          barClass="bg-emerald-400"
          orders={rightOrders}
          showCountdown
          holdMs={holdMs}
          now={now}
        />
      </main>

      <AnimatePresence>
        {popup && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              {...(popup.kind === "new" ? { layoutId: popup.order.posGroupId } : {})}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className={`w-full max-w-xl rounded-3xl border-2 p-10 sm:p-14 text-center shadow-2xl ${
                popup.kind === "ready"
                  ? "border-emerald-400/60 bg-[#0d1713] shadow-emerald-500/10"
                  : "border-amber-400/60 bg-[#141721] shadow-amber-500/10"
              }`}
            >
              <p
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest ${
                  popup.kind === "ready"
                    ? "bg-emerald-400/15 border-emerald-400/30 text-emerald-300"
                    : "bg-amber-400/15 border-amber-400/30 text-amber-300"
                }`}
              >
                <i
                  className={`${popup.kind === "ready" ? "fa-solid fa-bell-concierge" : "fa-solid fa-bell"}`}
                />
                {popup.kind === "ready" ? "Zur Abholung bereit" : "Neue Bestellung"}
              </p>
              <div
                className={`mt-6 text-8xl sm:text-9xl font-black tabular-nums leading-none ${
                  popup.kind === "ready" ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {popup.order.posOrderNumber != null ? `#${popup.order.posOrderNumber}` : "#—"}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderColumn({
  title,
  icon,
  accentClass,
  barClass,
  orders,
  interactive = false,
  showCountdown = false,
  holdMs = 0,
  now = 0,
  onMarkReady,
}: {
  title: string;
  icon: string;
  accentClass: string;
  barClass: string;
  orders: BoardOrder[];
  interactive?: boolean;
  showCountdown?: boolean;
  holdMs?: number;
  now?: number;
  onMarkReady?: (order: BoardOrder) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 lg:flex-none flex-col rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 sm:px-5 py-3">
        <h2 className={`flex items-center gap-2.5 text-sm sm:text-base font-black uppercase tracking-widest ${accentClass}`}>
          <i className={icon} />
          {title}
        </h2>
        <span className="flex items-center justify-center min-w-7 h-7 rounded-full bg-white/10 px-2 text-sm font-black tabular-nums">
          {orders.length}
        </span>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
        {orders.length === 0 ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-center text-white/30">
            <i className={`${icon} text-2xl opacity-50`} />
            <p className="text-sm font-bold">
              {showCountdown ? "Noch nichts abholbereit" : "Keine Bestellungen in Bearbeitung"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            <AnimatePresence initial={false}>
              {orders.map((order) => {
                const remaining = showCountdown && order.expiresAt != null ? order.expiresAt - now : null;
                const pct =
                  remaining != null && holdMs > 0
                    ? Math.max(0, Math.min(100, (remaining / holdMs) * 100))
                    : 100;
                const urgent = remaining != null && remaining < 60_000;
                return (
                  <motion.div
                    key={order.posGroupId}
                    layout
                    layoutId={order.posGroupId}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.25 } }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 sm:p-5 text-center ${
                      showCountdown
                        ? urgent
                          ? "border-red-400/50"
                          : "border-emerald-400/30"
                        : "border-amber-400/20"
                    }`}
                  >
                    <span className={`text-5xl sm:text-7xl font-black tabular-nums leading-none ${accentClass}`}>
                      {order.posOrderNumber != null ? `#${order.posOrderNumber}` : "#—"}
                    </span>
                    {showCountdown && remaining != null && (
                      <>
                        <span
                          className={`text-sm font-black tabular-nums ${urgent ? "text-red-400 animate-pulse" : "text-emerald-400"}`}
                        >
                          {formatCountdown(remaining)}
                        </span>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${urgent ? "bg-red-400" : barClass}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    )}
                    {interactive && !showCountdown && onMarkReady && (
                      <button
                        onClick={() => onMarkReady(order)}
                        className="mt-1 w-full rounded-xl bg-emerald-500/90 px-3 py-2 text-sm font-black text-white hover:bg-emerald-500 transition-colors active:scale-[0.98]"
                      >
                        <i className="fa-solid fa-check mr-1.5" />
                        Fertig
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
