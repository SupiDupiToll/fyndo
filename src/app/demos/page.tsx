import Link from "next/link";
import { demoProducts, demoPosProducts, demoOrders } from "@/lib/demo-data";

export default function DemosIndexPage() {
  return (
    <main className="min-h-screen bg-surf">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-12 sm:mb-16">
          <p className="inline-flex items-center gap-2 rounded-full bg-ink text-white px-4 py-1.5 text-xs font-black uppercase tracking-widest mb-4">
            <i className="fa-solid fa-flask" />
            Fyndo Demo
          </p>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
            Fyndo<span className="text-accent">.</span>
          </h1>
          <p className="text-mute mt-4 max-w-xl mx-auto leading-relaxed">
            Entdecke den Marktplatz und das POS-Kassensystem als interaktive Vorschau –
            komplett mit Beispieldaten und ohne echtes Checkout.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Link
            href="/demos/marketplace"
            className="group rounded-3xl border border-line bg-white p-8 sm:p-10 hover:shadow-xl hover:border-accent/30 transition-all flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent text-2xl">
                <i className="fa-solid fa-store" />
              </span>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                {demoProducts.length} Produkte
              </span>
            </div>
            <h2 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight group-hover:text-accent transition-colors">
              Fyndo Marktplatz
            </h2>
            <p className="mt-3 text-mute leading-relaxed flex-1">
              Alle öffentlichen Seiten: Produkte, Gutscheine, Concierge, Bestellungen, Verkäufer-Seiten
              und der komplette Admin-Bereich – zum Durchklicken, ohne etwas auszulösen.
            </p>
            <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white group-hover:bg-accent-hover transition-colors w-fit">
              Marktplatz öffnen
              <i className="fa-solid fa-arrow-right" />
            </span>
          </Link>

          <Link
            href="/demos/pos"
            className="group rounded-3xl border border-line bg-white p-8 sm:p-10 hover:shadow-xl hover:border-accent/30 transition-all flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent text-2xl">
                <i className="fa-solid fa-cash-register" />
              </span>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                {demoPosProducts.length} POS-Produkte
              </span>
            </div>
            <h2 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight group-hover:text-accent transition-colors">
              Fyndo POS
            </h2>
            <p className="mt-3 text-mute leading-relaxed flex-1">
              Das Kiosk-System von „Sweet Cream“: Becher & Schüsseln wählen, Kugeln und Toppings
              zusammenstellen und den gesamten Bestellablauf bis zur Bezahlung simulieren.
            </p>
            <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white group-hover:bg-accent-hover transition-colors w-fit">
              POS öffnen
              <i className="fa-solid fa-arrow-right" />
            </span>
          </Link>
        </div>

        <p className="text-center text-xs text-mute mt-10">
          {demoOrders.length} Beispiel-Bestellungen · Alle Aktionen sind ohne Funktion – du kannst die Seiten nur anschauen.
        </p>
      </div>
    </main>
  );
}
