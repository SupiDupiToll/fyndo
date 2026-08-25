"use client";

import { useEffect, useState } from "react";

function simpleHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

async function playChime() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    await ctx.resume();
    [0, 0.15, 0.3].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660 * Math.pow(1.335, i);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.3);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.32);
    });
  } catch {
    /* audio not supported */
  }
}

type InfoRow = { label: string; value: string };

export function PosDebugMenu({
  vendorName,
  adminEnabled,
  onClose,
}: {
  vendorName: string;
  adminEnabled: boolean;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [warning, setWarning] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function verify(candidate: string) {
    try {
      const res = await fetch("/api/pos/admin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor: vendorName, code: candidate }),
      });
      const data = await res.json();
      return !!data.valid;
    } catch {
      return false;
    }
  }

  const [unlocked, setUnlocked] = useState(false);

  async function handleUnlock() {
    setError("");
    setWarning("");
    if (!adminEnabled) {
      setWarning("Das Admin-Menü ist auf diesem Gerät deaktiviert.");
      return;
    }
    if (!code) {
      setError("Bitte Code eingeben.");
      return;
    }
    setChecking(true);
    const ok = await verify(code);
    setChecking(false);
    if (ok) {
      setUnlocked(true);
      setCode("");
    } else {
      setError("Falscher Code.");
    }
  }

  const infoRows: InfoRow[] = [
    { label: "Standort", value: window.location.href },
    { label: "Viewport", value: `${window.innerWidth}×${window.innerHeight}` },
    { label: "DPR", value: String(window.devicePixelRatio ?? 1) },
    { label: "User-Agent", value: navigator.userAgent },
    { label: "Online", value: navigator.onLine ? "Ja" : "Nein" },
    { label: "Sprache", value: navigator.language },
    { label: "Verkäufer", value: vendorName },
  ];

  function copyValue(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text.slice(0, 8));
      window.setTimeout(() => setCopied(""), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black flex items-center gap-2">
            <i className="fa-solid fa-bug text-accent" />
            Diagnose
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-surf dark:hover:bg-tile flex items-center justify-center"
            aria-label="Schließen"
          >
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        {!unlocked ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-mute mb-2">
                Admin-Code eingeben
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  className="flex-1 rounded-xl border border-line px-4 py-3 text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-accent"
                  placeholder="••••"
                />
              </div>
              {error && <p className="mt-2 text-sm font-bold text-red-500">{error}</p>}
              {warning && <p className="mt-2 text-sm font-bold text-amber-500">{warning}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleUnlock}
                  disabled={checking}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {checking ? "Prüfe..." : "Entsperren"}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-line px-4 py-3 font-bold text-mute"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-black uppercase tracking-wider text-mute mb-2">
                Aktionen
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-line p-4 hover:border-accent hover:text-accent"
                >
                  <i className="fa-solid fa-rotate text-xl" />
                  <span className="text-xs font-bold">Neu laden</span>
                </button>
                <button
                  onClick={() => {
                    playChime();
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-line p-4 hover:border-accent hover:text-accent"
                >
                  <i className="fa-solid fa-volume-high text-xl" />
                  <span className="text-xs font-bold">Ton testen</span>
                </button>
                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      document.documentElement.requestFullscreen();
                    }
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-line p-4 hover:border-accent hover:text-accent"
                >
                  <i className="fa-solid fa-expand text-xl" />
                  <span className="text-xs font-bold">Vollbild</span>
                </button>
                <button
                  onClick={() => {
                    window.open("/", "_self");
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-line p-4 hover:border-accent hover:text-accent"
                >
                  <i className="fa-solid fa-house text-xl" />
                  <span className="text-xs font-bold">Startseite</span>
                </button>
                <button
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-red-200 p-4 text-red-600 hover:bg-red-50"
                >
                  <i className="fa-solid fa-trash-can text-xl" />
                  <span className="text-xs font-bold">Cache leeren</span>
                </button>
                <button
                  onClick={() => onClose()}
                  className="flex flex-col items-center gap-1 rounded-xl border border-line p-4 hover:border-accent hover:text-accent"
                >
                  <i className="fa-solid fa-arrow-left text-xl" />
                  <span className="text-xs font-bold">Schließen</span>
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-black uppercase tracking-wider text-mute mb-2">
                Systeminformationen
              </h3>
              <div className="overflow-hidden rounded-xl border border-line">
                {infoRows.map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex items-start justify-between gap-4 p-3 ${i % 2 ? "bg-surf/50" : ""}`}
                  >
                    <span className="shrink-0 text-xs font-bold text-mute w-24">{row.label}</span>
                    <button
                      onClick={() => copyValue(row.value)}
                      className="text-left break-all text-xs text-ink/80 hover:text-accent"
                      title="Zum Kopieren klicken"
                    >
                      {row.value}
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-[10px] text-mute h-4" aria-live="polite">
                {copied ? "In die Zwischenablage kopiert ✓" : ""}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
