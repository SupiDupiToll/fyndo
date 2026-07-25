"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Seller {
  id: string;
  email: string;
  displayName: string;
  sellerName: string | null;
  role: string;
  _count: { products: number };
}

export default function AdminSellersPage() {
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/sellers")
      .then((r) => r.json())
      .then((data) => setSellers(data))
      .catch(() => setError("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !sellerName) { setError("E-Mail und Name sind erforderlich."); return; }
    setCreating(true); setError("");

    try {
      const res = await fetch("/api/admin/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sellerName }),
      });
      const data = await res.json() as { error?: string; id?: string };
      if (!res.ok) { setError(data.error ?? "Fehler"); return; }

      setEmail(""); setSellerName("");
      router.refresh();

      const updated = await fetch("/api/admin/sellers").then((r) => r.json());
      setSellers(updated);
    } catch {
      setError("Fehler beim Erstellen");
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verkäufer</h1>
        <p className="text-mute mt-1">Verkäufer verwalten.</p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold mb-1.5 text-mute">E-Mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-accent" placeholder="user@example.com" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold mb-1.5 text-mute">Shop-Name</label>
          <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-accent" placeholder="Mein Shop" />
        </div>
        <button type="submit" disabled={creating} className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0">
          {creating ? "..." : "Hinzufügen"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="text-mute">Lade...</div>
      ) : sellers.length === 0 ? (
        <p className="text-mute">Keine Verkäufer.</p>
      ) : (
        <div className="space-y-2">
          {sellers.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4">
              <div>
                <p className="font-bold">{s.sellerName ?? s.displayName}</p>
                <p className="text-sm text-mute">{s.email}</p>
              </div>
              <div className="text-right text-sm">
                <span className="text-mute">{s._count.products} Produkte</span>
                <span className={`ml-3 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${s.role === "SUPER_ADMIN" ? "bg-accent/10 text-accent" : "bg-surf text-mute"}`}>
                  {s.role === "SUPER_ADMIN" ? "Admin" : "Verkäufer"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
