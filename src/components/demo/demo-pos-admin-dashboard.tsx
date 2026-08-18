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
  const openCount = demoGroups.filter((g) => g.status === "PENDING" || g.status === "DONE").length;
  const paidTotal = demoGroups
    .filter((g) => g.status === "PAID")
    .reduce((s, g) => s + g.totalCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">POS-Kasse</h1>
          <p className="text-sm text-mute mt-1">{vendorName}</p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest">
            <i className="fa-solid fa-flask" />
            Demo
          </span>
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
          <p className="text-3xl font-bold mt-1 text-mute">Off</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        <i className="fa-solid fa-flask mr-2" />
        Demo: Die Bestellungen sind feste Beispieldaten – Bestätigen, Ausführen und Stornieren sind deaktiviert.
      </div>

      <div className="space-y-3">
        {demoGroups.map((group) => {
          const time = new Date(group.createdAt);
          return (
            <div key={group.posGroupId} className="rounded-2xl border border-line bg-white p-4">
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
        })}
      </div>

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
