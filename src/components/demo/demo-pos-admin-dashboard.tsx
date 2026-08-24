"use client";

import { useState } from "react";
import { formatEuro } from "@/lib/format";

type DemoPosGroup = {
  posGroupId: string;
  posOrderNumber: number;
  method: string | null;
  status: "PENDING" | "PAID" | "DONE" | "CANCELLED";
  totalCents: number;
  quantity: number;
  createdAt: string;
  items: { title: string; variantName: string | null; containerName: string | null; amountCents: number; qty: number }[];
};

const METHOD_LABELS: Record<string, string> = {
  RBANK: "RBank",
  TIPPIE: "QR (PayPal/Apple Pay/Karte)",
  TERMINAL: "Kartenterminal",
  CASH: "Bar",
  GUTSCHEIN: "Gutschein",
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

const daysAgo = (n: number, h = 14) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 30, 0, 0);
  return d.toISOString();
};

const demoGroups: DemoPosGroup[] = [
  {
    posGroupId: "g-1",
    posOrderNumber: 104,
    method: "TERMINAL",
    status: "PENDING",
    totalCents: 920,
    quantity: 4,
    createdAt: daysAgo(0, 10),
    items: [
      { title: "Becher", variantName: null, containerName: null, amountCents: 50, qty: 1 },
      { title: "Vanille Kugel", variantName: null, containerName: "Becher 1", amountCents: 150, qty: 2 },
      { title: "Schokolade Kugel", variantName: null, containerName: "Becher 1", amountCents: 150, qty: 1 },
      { title: "Sahne", variantName: null, containerName: null, amountCents: 60, qty: 1 },
    ],
  },
  {
    posGroupId: "g-4",
    posOrderNumber: 106,
    method: "CASH",
    status: "PENDING",
    totalCents: 560,
    quantity: 2,
    createdAt: daysAgo(0, 8),
    items: [
      { title: "Becher", variantName: null, containerName: null, amountCents: 50, qty: 1 },
      { title: "Mango-Sorbet Kugel", variantName: "Doppel", containerName: "Becher 1", amountCents: 290, qty: 1 },
      { title: "Streusel", variantName: null, containerName: null, amountCents: 40, qty: 1 },
    ],
  },
  {
    posGroupId: "g-2",
    posOrderNumber: 103,
    method: "TIPPIE",
    status: "PAID",
    totalCents: 1150,
    quantity: 3,
    createdAt: daysAgo(0, 9),
    items: [
      { title: "Schüssel", variantName: null, containerName: null, amountCents: 100, qty: 1 },
      { title: "Mango-Sorbet Kugel", variantName: "Doppel", containerName: "Schüssel 1", amountCents: 290, qty: 1 },
      { title: "Erdbeere Kugel", variantName: null, containerName: "Schüssel 1", amountCents: 150, qty: 1 },
      { title: "Streusel", variantName: null, containerName: null, amountCents: 40, qty: 1 },
    ],
  },
  {
    posGroupId: "g-5",
    posOrderNumber: 105,
    method: "RBANK",
    status: "PAID",
    totalCents: 780,
    quantity: 3,
    createdAt: daysAgo(0, 7),
    items: [
      { title: "Schüssel", variantName: null, containerName: null, amountCents: 100, qty: 1 },
      { title: "Vanille Kugel", variantName: null, containerName: "Schüssel 1", amountCents: 150, qty: 2 },
      { title: "Schokosauce", variantName: null, containerName: null, amountCents: 50, qty: 1 },
    ],
  },
  {
    posGroupId: "g-3",
    posOrderNumber: 102,
    method: "CASH",
    status: "DONE",
    totalCents: 760,
    quantity: 2,
    createdAt: daysAgo(1, 15),
    items: [
      { title: "Becher", variantName: null, containerName: null, amountCents: 50, qty: 1 },
      { title: "Vanille Kugel", variantName: null, containerName: "Becher 1", amountCents: 150, qty: 2 },
      { title: "Nüsse", variantName: null, containerName: null, amountCents: 70, qty: 1 },
    ],
  },
];

export function DemoPosAdminDashboard({ vendorName }: { vendorName: string }) {
  const [showAll, setShowAll] = useState(false);

  const pendingGroups = demoGroups.filter((g) => g.status === "PENDING");
  const paidGroups = demoGroups.filter((g) => g.status === "PAID");
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
            href="/demos/pos-board"
            className="flex items-center gap-2 rounded-xl bg-ink text-white px-4 py-2 text-sm font-bold hover:bg-ink/90 transition-colors"
            title="Bestellübersicht (Board) mit Live-Simulation öffnen"
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
              {demoGroups.length}
            </span>
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest">
            <i className="fa-solid fa-flask" />
            Demo
          </span>
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
          <p className="text-3xl font-bold mt-1 text-mute">Off</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        <i className="fa-solid fa-flask mr-2" />
        Demo: Die Bestellungen sind feste Beispieldaten – Bestätigen, Ausführen und Stornieren sind deaktiviert.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <DemoColumnHeader
            title="Zu bestätigen"
            subtitle="noch nicht bezahlt"
            count={pendingGroups.length}
            dotClass="bg-yellow-500"
            textClass="text-yellow-700"
          />
          <div className="mt-3 space-y-3">
            {pendingGroups.length === 0 ? (
              <DemoEmptyState text="Keine unbezahlten Bestellungen." />
            ) : (
              pendingGroups.map((group) => <DemoOrderCard key={group.posGroupId} group={group} />)
            )}
          </div>
        </section>

        <section>
          <DemoColumnHeader
            title="In Bearbeitung"
            subtitle="bezahlt, noch nicht ausgeführt"
            count={paidGroups.length}
            dotClass="bg-green-600"
            textClass="text-green-700"
          />
          <div className="mt-3 space-y-3">
            {paidGroups.length === 0 ? (
              <DemoEmptyState text="Keine bezahlten Bestellungen in Bearbeitung." />
            ) : (
              paidGroups.map((group) => <DemoOrderCard key={group.posGroupId} group={group} />)
            )}
          </div>
        </section>
      </div>

      {showAll && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-line shrink-0">
              <h2 className="text-xl font-bold tracking-tight">
                Alle Bestellungen{" "}
                <span className="text-mute text-base font-medium">({demoGroups.length})</span>
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
              {demoGroups.length === 0 ? (
                <DemoEmptyState text="Keine Bestellungen vorhanden." />
              ) : (
                [...demoGroups]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((group) => <DemoOrderCard key={group.posGroupId} group={group} />)
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-3 py-1 text-[11px] font-black uppercase tracking-widest">
            <i className="fa-solid fa-flask" />
            Demo
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-line p-4">
            <span className="text-xs font-bold text-mute uppercase tracking-wider">Inaktivität (Sekunden)</span>
            <p className="mt-2 text-lg font-bold">60</p>
            <span className="mt-1 block text-xs text-mute">Nach dieser Zeit ohne Bedienung.</span>
          </div>
          <div className="rounded-xl border border-line p-4">
            <span className="text-xs font-bold text-mute uppercase tracking-wider">Auto-Lock nach Bestellung (Sekunden)</span>
            <p className="mt-2 text-lg font-bold">15</p>
            <span className="mt-1 block text-xs text-mute">Erfolgs-Screen danach automatisch sperren.</span>
          </div>
          <div className="rounded-xl border border-line p-4">
            <span className="text-xs font-bold text-mute uppercase tracking-wider">Beim Öffnen anzeigen</span>
            <p className="mt-2 text-lg font-bold">Aktiv</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function DemoColumnHeader({
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

function DemoEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-10 text-center text-sm text-mute">
      {text}
    </div>
  );
}

function DemoOrderCard({ group }: { group: DemoPosGroup }) {
  const time = new Date(group.createdAt);
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-8 h-8 rounded-lg bg-accent text-white px-2 text-sm font-black tabular-nums">
              #{group.posOrderNumber}
            </span>
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
            <span className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-mute cursor-not-allowed">Bezahlt ✓</span>
          )}
          {group.status === "PAID" && (
            <span className="rounded-xl bg-tile px-4 py-2 text-sm font-bold text-mute cursor-not-allowed">Ausgeführt ✓</span>
          )}
        </div>
      </div>
    </div>
  );
}
