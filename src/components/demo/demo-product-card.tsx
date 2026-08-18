import Link from "next/link";
import { formatEuro } from "@/lib/format";
import { demoPriceLabel, type DemoProduct } from "@/lib/demo-data";

export function DemoProductCard({ product }: { product: DemoProduct }) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  return (
    <div className="group border border-line rounded-2xl p-4 hover:shadow-lg transition-all bg-white flex flex-col">
      <Link href={`/demos/marketplace/products/${product.id}`} className="block">
        <div className="aspect-square rounded-xl overflow-hidden bg-surf mb-4">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="w-full h-full object-contain p-4 transition-transform group-hover:scale-105" src={product.imageUrl} alt={product.title} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-mute text-sm">
              {product.kind === "VOUCHER" ? "Gutschein" : "Kein Bild"}
            </div>
          )}
        </div>
        <h3 className="font-bold group-hover:text-accent transition-colors line-clamp-2">{product.title}</h3>
      </Link>
      <p className="text-xl font-black mt-2">{demoPriceLabel(product)}</p>
      {variants.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {variants.slice(0, 3).map((v) => (
            <span key={v.id} className="rounded-full border border-line bg-surf px-2 py-0.5 text-[11px] font-medium text-mute">
              {v.name} · {formatEuro(v.priceCents)}
            </span>
          ))}
          {variants.length > 3 && (
            <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-mute">
              +{variants.length - 3}
            </span>
          )}
        </div>
      )}
      <Link
        href={`/demos/marketplace/vendor/${encodeURIComponent(product.seller.sellerName ?? product.seller.displayName ?? "")}`}
        className="text-xs text-mute hover:text-accent mt-1 block transition-colors"
      >
        {product.seller.sellerName ?? product.seller.displayName}
      </Link>
      <div className="mt-4">
        <Link
          href={`/demos/marketplace/checkout/${product.id}`}
          className="block w-full text-center bg-accent text-white py-3 rounded-xl font-bold hover:bg-accent-hover transition-colors"
        >
          Jetzt kaufen
        </Link>
      </div>
    </div>
  );
}
