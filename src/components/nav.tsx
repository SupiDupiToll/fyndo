"use client";

import { useUser, useHexclaveApp } from "@hexclave/next";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Nav() {
  const user = useUser();
  const app = useHexclaveApp();
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data.role === "SUPER_ADMIN" || data.role === "SELLER"))
      .catch(() => setIsAdmin(false));
  }, [user]);

  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-line">
      <nav className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="text-xl sm:text-2xl font-extrabold tracking-tight">Fyndo<span className="text-accent">.</span></Link>

        <form action="/products" method="GET" className="hidden sm:flex items-center flex-1 max-w-md mx-4 lg:mx-10 bg-surf rounded-full px-5 py-2 border border-transparent focus-within:border-accent/30 transition-colors">
          <i className="fa-solid fa-magnifying-glass text-mute text-sm"></i>
          <input name="q" type="text" placeholder="Wonach suchst du?" className="bg-transparent border-none outline-none ml-3 w-full text-sm" />
        </form>

        <div className="hidden sm:flex items-center gap-4 lg:gap-6 text-sm font-semibold">
          <Link href="/products" className="hover:text-accent transition-colors">Marktplatz</Link>
          <Link href="/concierge" className="hover:text-accent transition-colors">Concierge</Link>
          <Link href="/gift-cards" className="hover:text-accent transition-colors">Gutschein</Link>
          <Link href="/bestellungen" className="hover:text-accent transition-colors">Bestellungen</Link>
          {isAdmin && <Link href="/admin" className="text-accent hover:text-blue-700 transition-colors">Admin</Link>}
          {user ? (
            <button onClick={() => user.signOut()} className="text-mute hover:text-accent font-medium">Abmelden</button>
          ) : (
            <button onClick={() => app.redirectToSignIn()} className="text-accent hover:text-blue-700">Einloggen</button>
          )}
        </div>

        <div className="flex sm:hidden items-center gap-3">
          <Link href="/products?q=" className="text-mute hover:text-accent" aria-label="Suchen">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </Link>
          <button onClick={() => setOpen(!open)} className="text-ink p-1" aria-label="Menü">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 top-14 z-40 bg-white flex flex-col sm:hidden">
          <form action="/products" method="GET" className="px-4 pt-4 pb-3">
            <div className="flex items-center bg-surf rounded-full px-5 py-2.5 border border-line">
              <i className="fa-solid fa-magnifying-glass text-mute text-sm"></i>
              <input name="q" type="text" placeholder="Wonach suchst du?" className="bg-transparent border-none outline-none ml-3 w-full text-sm" />
            </div>
          </form>
          <div className="flex flex-col px-4 gap-1">
            <Link href="/products" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-base font-bold hover:bg-surf transition-colors">Marktplatz</Link>
            <Link href="/concierge" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-base font-bold hover:bg-surf transition-colors">Concierge</Link>
            <Link href="/gift-cards" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-base font-bold hover:bg-surf transition-colors">Gutschein</Link>
            <Link href="/bestellungen" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-base font-bold hover:bg-surf transition-colors">Bestellungen</Link>
            {isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-base font-bold text-accent hover:bg-surf transition-colors">Admin</Link>}
          </div>
          <div className="mt-auto px-4 pb-8 border-t border-line pt-4">
            {user ? (
              <button onClick={() => { user.signOut(); setOpen(false); }} className="w-full rounded-xl bg-accent text-white py-3 text-sm font-bold">Abmelden</button>
            ) : (
              <button onClick={() => { app.redirectToSignIn(); setOpen(false); }} className="w-full rounded-xl bg-accent text-white py-3 text-sm font-bold">Einloggen</button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
