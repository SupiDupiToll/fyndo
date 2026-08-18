import { notFound } from "next/navigation";
import { getDemoProduct } from "@/lib/demo-data";
import { DemoCheckoutPanel } from "@/components/demo/demo-checkout-panel";

export const dynamic = "force-dynamic";

export default async function DemoCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getDemoProduct(id);
  if (!product) notFound();

  return (
    <div className="max-w-[600px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Bestellübersicht</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-3 py-1 text-[11px] font-black uppercase tracking-widest">
          <i className="fa-solid fa-flask" />
          Demo
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-white">
        <div className="aspect-[2/1] bg-tile">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain p-4" />
          ) : (
            <div className="flex h-full items-center justify-center text-mute">Kein Bild</div>
          )}
        </div>

        <div className="p-6">
          <h2 className="text-xl font-bold">{product.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-mute line-clamp-3">
            {product.description}
          </p>
        </div>
      </div>

      <DemoCheckoutPanel product={product} />
    </div>
  );
}
