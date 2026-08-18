import { demoVendors } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default function DemoAdminSellersPage() {
  const sellers = demoVendors.filter((v) => v.role !== "SUPER_ADMIN");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verkäufer</h1>
        <p className="text-mute mt-1">Verkäufer verwalten. (Demo – nur Ansicht)</p>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold mb-1.5 text-mute">E-Mail</label>
          <input type="email" disabled placeholder="user@example.com" className="w-full rounded-xl border border-line bg-tile px-4 py-3 text-sm outline-none text-mute cursor-not-allowed" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold mb-1.5 text-mute">Shop-Name</label>
          <input disabled placeholder="Mein Shop" className="w-full rounded-xl border border-line bg-tile px-4 py-3 text-sm outline-none text-mute cursor-not-allowed" />
        </div>
        <button disabled className="rounded-xl bg-tile px-6 py-3 text-sm font-bold text-mute cursor-not-allowed shrink-0">Hinzufügen</button>
      </div>

      <div className="space-y-2">
        {sellers.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4">
            <div>
              <p className="font-bold">{s.sellerName ?? s.displayName}</p>
              <p className="text-sm text-mute">{s.email}</p>
            </div>
            <div className="text-right text-sm">
              <span className="text-mute">
                {s.sellerName === "Sweet Cream" ? 10 : s.sellerName === "RundiShop" ? 4 : 3} Produkte
              </span>
              <span className="ml-3 inline-block rounded-full px-3 py-0.5 text-xs font-bold bg-surf text-mute">
                Verkäufer
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
