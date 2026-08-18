import { notFound } from "next/navigation";
import Link from "next/link";
import { formatEuro } from "@/lib/format";
import { getDemoProduct, demoPriceLabel } from "@/lib/demo-data";
import { DemoVariantPicker } from "@/components/demo/demo-variant-picker";

export const dynamic = "force-dynamic";

export default async function DemoProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getDemoProduct(id);
  if (!product) notFound();

  const priceLabel = demoPriceLabel(product);
  const variants = product.kind === "PRODUCT" ? (product.variants ?? []) : [];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="grid gap-8 md:gap-12 md:grid-cols-2 items-start">
        <div className="aspect-square overflow-hidden rounded-3xl bg-tile">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain p-6 sm:p-8" />
          ) : (
            <div className="flex h-full items-center justify-center text-mute">
              {product.kind === "VOUCHER" ? "Gutschein" : "Kein Bild"}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-accent uppercase tracking-wider bg-accent/10 px-3 py-1 rounded-full">
              {product.kind === "VOUCHER" ? "Gutschein" : "Produkt"}
            </span>
            <Link
              href={`/demos/marketplace/vendor/${encodeURIComponent(product.seller.sellerName ?? product.seller.displayName ?? "")}`}
              className="text-xs text-mute hover:text-accent transition-colors"
            >
              von <strong className="text-ink">{product.seller.sellerName ?? product.seller.displayName}</strong>
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{product.title}</h1>
          <p className="mt-4 sm:mt-6 text-mute leading-relaxed">{product.description}</p>

          {variants.length > 0 ? (
            <DemoVariantPicker productId={product.id} variants={variants} basePriceCents={product.price} />
          ) : (
            <>
              <p className="mt-6 sm:mt-8 text-3xl font-black">{priceLabel}</p>
              <Link
                href={`/demos/marketplace/checkout/${product.id}`}
                className="mt-8 inline-flex items-center justify-center bg-accent text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-accent-hover transition-all w-full sm:w-auto"
              >
                Jetzt kaufen
              </Link>
              <p className="mt-3 text-xs text-mute">
                Demo-Modus: Es wird keine echte Bestellung ausgelöst.
              </p>
            </>
          )}

          {product.kind === "VOUCHER" && product.voucherNoticeText && (
            <div className="mt-6 rounded-xl border border-line bg-surf p-4 text-xs text-mute leading-relaxed whitespace-pre-line">
              {product.voucherNoticeText}
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 text-xs text-mute">
        <Link href="/demos/marketplace" className="text-accent hover:underline">
          ← Zurück zum Marktplatz
        </Link>
      </div>
    </div>
  );
}
