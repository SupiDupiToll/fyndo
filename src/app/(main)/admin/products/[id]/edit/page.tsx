"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CameraUpload } from "@/components/camera-upload";
import { VariantEditor, variantRowsToPayload, type VariantRow } from "@/components/pos/variant-editor";

interface ProductForm {
  title: string;
  description: string;
  imageUrl: string;
  price: string;
  isActive: boolean;
  posVisible: boolean;
  posOnly: boolean;
  isContainer: boolean;
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProductForm>({ title: "", description: "", imageUrl: "", price: "", isActive: true, posVisible: true, posOnly: false, isContainer: false });
  const [variants, setVariants] = useState<VariantRow[]>([]);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products/${productId}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          title: data.title ?? "",
          description: data.description ?? "",
          imageUrl: data.imageUrl ?? "",
          price: data.price ? (data.price / 100).toFixed(2) : "",
          isActive: data.isActive ?? true,
          posVisible: data.posVisible ?? true,
          posOnly: data.posOnly ?? false,
          isContainer: data.isContainer ?? false,
        });
        setVariants(
          Array.isArray(data.variants)
            ? data.variants.map((v: { id: string; name: string; priceCents: number }) => ({
                id: v.id,
                name: v.name,
                price: v.priceCents != null ? (v.priceCents / 100).toFixed(2) : "",
              }))
            : [],
        );
      })
      .catch(() => setError("Produkt nicht gefunden"))
      .finally(() => setPageLoading(false));
  }, [productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description || !form.price) { setError("Titel, Beschreibung und Preis sind erforderlich."); return; }

    setLoading(true); setError("");

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, variants: variantRowsToPayload(variants) }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Fehler beim Speichern."); return; }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Fehler beim Speichern.");
    } finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!window.confirm("Produkt wirklich löschen?")) return;
    setLoading(true); setError("");

    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Fehler beim Löschen."); return; }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Fehler beim Löschen.");
    } finally { setLoading(false); }
  }

  if (pageLoading) return <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" /></div>;
  if (error && !form.title) return <p className="text-red-600">{error}</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Produkt bearbeiten</h1>

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
        <VariantEditor initial={variants} onChange={setVariants} />
        <div className="flex items-center gap-3">
          <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-5 w-5 rounded border-line accent-accent" />
          <label htmlFor="isActive" className="text-sm font-bold">Produkt ist aktiv (überall sichtbar)</label>
        </div>
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

        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={loading} className="rounded-xl bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? "Speichere..." : "Speichern"}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-xl border border-line px-8 py-3 text-sm font-bold hover:bg-surf transition-colors">
            Abbrechen
          </button>
          <button type="button" onClick={handleDelete} disabled={loading} className="ml-auto rounded-xl border border-red-200 bg-red-50 px-8 py-3 text-sm font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
            Löschen
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
