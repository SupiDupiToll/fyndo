"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DemoToggle() {
  const pathname = usePathname();
  const isPos = pathname.startsWith("/demos/pos");
  const isMarketplace = pathname.startsWith("/demos/marketplace") || pathname === "/demos";

  return (
    <div className="bg-ink text-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest">
            <i className="fa-solid fa-flask" />
            Demo
          </span>
          <span className="hidden sm:inline text-sm text-white/60 truncate">
            Nur Vorschau – keine echte Bestellung
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
          <Link
            href="/demos/marketplace"
            aria-current={isMarketplace ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              isMarketplace ? "bg-white text-ink" : "text-white/70 hover:text-white"
            }`}
          >
            <i className="fa-solid fa-store mr-1.5" />
            Fyndo Marktplatz
          </Link>
          <Link
            href="/demos/pos"
            aria-current={isPos ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              isPos ? "bg-white text-ink" : "text-white/70 hover:text-white"
            }`}
          >
            <i className="fa-solid fa-cash-register mr-1.5" />
            Fyndo POS
          </Link>
        </div>

        <Link
          href="/"
          className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        >
          <i className="fa-solid fa-arrow-up-right-from-square mr-1" />
          <span className="hidden sm:inline">Live-Seite</span>
          <span className="sm:hidden">Live</span>
        </Link>
      </div>
    </div>
  );
}
