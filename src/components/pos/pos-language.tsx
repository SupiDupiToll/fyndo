"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  POS_LANG_STORAGE_KEY,
  posT,
  type PosLang,
  type PosTranslationKey,
} from "@/lib/pos-i18n";

type PosLanguageContextValue = {
  lang: PosLang;
  setLang: (lang: PosLang) => void;
  t: (
    key: PosTranslationKey,
    vars?: Record<string, string | number>,
  ) => string;
};

const PosLanguageContext = createContext<PosLanguageContextValue | null>(null);

export function PosLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<PosLang>("de");

  // Erst nach dem Mount lesen, damit Server- und Client-Render übereinstimmen.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(POS_LANG_STORAGE_KEY);
      if (stored === "de" || stored === "zh") {
        setLangState(stored);
        document.documentElement.lang = stored === "zh" ? "zh-CN" : "de";
      }
    } catch {
      /* Storage nicht verfügbar */
    }
  }, []);

  const setLang = useCallback((next: PosLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(POS_LANG_STORAGE_KEY, next);
    } catch {
      /* Storage nicht verfügbar */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "zh" ? "zh-CN" : "de";
    }
  }, []);

  const t = useCallback(
    (key: PosTranslationKey, vars?: Record<string, string | number>) =>
      posT(lang, key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <PosLanguageContext.Provider value={value}>
      {children}
    </PosLanguageContext.Provider>
  );
}

export function usePosLang() {
  const ctx = useContext(PosLanguageContext);
  if (!ctx) {
    throw new Error("usePosLang muss innerhalb von PosLanguageProvider stehen.");
  }
  return ctx;
}

function FlagDE({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#000000" />
      <rect y="6.667" width="30" height="6.667" fill="#DD0000" />
      <rect y="13.333" width="30" height="6.667" fill="#FFCE00" />
    </svg>
  );
}

function starPoints(cx: number, cy: number, outer: number) {
  const inner = outer * 0.382;
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

function FlagCN({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#DE2910" />
      <g fill="#FFDE00">
        <polygon points={starPoints(5.5, 5, 3)} />
        <polygon points={starPoints(11, 2.2, 1)} />
        <polygon points={starPoints(12.8, 4.9, 1)} />
        <polygon points={starPoints(12.8, 8, 1)} />
        <polygon points={starPoints(11, 10.7, 1)} />
      </g>
    </svg>
  );
}

const LANGUAGES: { lang: PosLang; label: string; short: string; Flag: typeof FlagDE }[] =
  [
    { lang: "de", label: "Deutsch", short: "DE", Flag: FlagDE },
    { lang: "zh", label: "中文", short: "中文", Flag: FlagCN },
  ];

export function PosLanguageSwitch({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const { lang, setLang } = usePosLang();
  const dark = tone === "dark";

  return (
    <div
      role="group"
      aria-label="Sprache / 语言"
      className={`flex items-center gap-1 rounded-full border p-1 ${
        dark ? "border-white/30 bg-white/15 backdrop-blur" : "border-line bg-white"
      } ${className}`}
    >
      {LANGUAGES.map(({ lang: value, label, short, Flag }) => {
        const active = lang === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLang(value)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors sm:px-3 ${
              active
                ? dark
                  ? "bg-white text-ink"
                  : "bg-accent text-white"
                : dark
                  ? "text-white/80 hover:bg-white/10"
                  : "text-mute hover:bg-surf"
            }`}
          >
            <span className="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10">
              <Flag className="h-full w-full object-cover" />
            </span>
            <span className="hidden sm:inline">{short}</span>
          </button>
        );
      })}
    </div>
  );
}
