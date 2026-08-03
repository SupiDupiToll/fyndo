"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CameraUpload } from "@/components/camera-upload";
import { VariantEditor, variantRowsToPayload, type VariantRow } from "@/components/pos/variant-editor";

export default function CreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    price: "",
    kind: "PRODUCT" as "PRODUCT" | "VOUCHER",
    posVisible: true,
    posOnly: false,
    isContainer: false,
  });
  const [variants, setVariants] = useState<VariantRow[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description || !form.price) { setError("Titel, Beschreibung und Preis sind erforderlich."); return; }

    setLoading(true); setError("");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, variants: variantRowsToPayload(variants) }),
      });
      const data = await res.json() as { error?: string; id?: string };

      if (!res.ok) { setError(data.error ?? "Fehler beim Erstellen."); return; }

      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Fehler beim Erstellen.");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Produkt erstellen</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold mb-2">Titel</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border border-line bg-white px-5 py-3.5 outline-none focus:border-accent transition-colors" required />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Beschreibung</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full rounded-xl border border-line bg-white px-5 py-3.5 outline-none focus:border-accent transition-colors resize-none" required />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Bild</label>
          <CameraUpload onUrl={(url) => setForm({ ...form, imageUrl: url })} currentUrl={form.imageUrl} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Preis (€)</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-mute font-medium">€</span>
            <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full rounded-xl border border-line bg-white pl-10 pr-5 py-3.5 outline-none focus:border-accent transition-colors" required />
          </div>
          <p className="text-xs text-mute mt-2">Basispreis. Wird im Kiosk angezeigt, wenn es keine Varianten gibt.</p>
        </div>
        <VariantEditor initial={[]} onChange={setVariants} />
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="posVisible" checked={form.posVisible} onChange={(e) => setForm({ ...form, posVisible: e.target.checked })} className="h-5 w-5 rounded border-line accent-accent" />
            <label htmlFor="posVisible" className="text-sm font-bold">Im POS-Kiosk anzeigen</label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="posOnly" checked={form.posOnly} onChange={(e) => setForm({ ...form, posOnly: e.target.checked })} className="h-5 w-5 rounded border-line accent-accent" />
            <label htmlFor="posOnly" className="text-sm font-bold">Nur im POS anzeigen (nicht im Shop)</label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isContainer" checked={form.isContainer} onChange={(e) => setForm({ ...form, isContainer: e.target.checked })} className="h-5 w-5 rounded border-line accent-accent" />
            <label htmlFor="isContainer" className="text-sm font-bold">Ist ein Becher / Schüssel (Eisdiele)</label>
          </div>
        </div>
        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={loading} className="rounded-xl bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? "Erstelle..." : "Produkt erstellen"}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-xl border border-line px-8 py-3 text-sm font-bold hover:bg-surf transition-colors">
            Abbrechen
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
