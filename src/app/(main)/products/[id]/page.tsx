import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatEuro } from "@/lib/format";
import {
  getVoucherAmounts,
  getProductPriceLabel,
} from "@/lib/shop";
import Link from "next/link";
import { getVendorHref, getVendorName } from "@/lib/vendor";
import { parseVariants, type ProductVariant } from "@/lib/product-variants";
import { ProductVariantPicker } from "@/components/product-variant-picker";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const product = await prisma.product.findUnique({
    where: { id },
    include: { seller: { select: { sellerName: true, displayName: true } } },
  });
  if (!product || !product.isActive || product.posOnly) notFound();

  const priceLabel = getProductPriceLabel(product);
  const variants: ProductVariant[] =
    product.kind === "PRODUCT" ? (parseVariants(product.variants) ?? []) : [];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="grid gap-8 md:gap-12 md:grid-cols-2 items-start">
        <div className="aspect-square overflow-hidden rounded-3xl bg-tile">
          {product.imageUrl ? (
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
            <Link href={getVendorHref(product.seller)} className="text-xs text-mute hover:text-accent transition-colors">
              von <strong className="text-ink">{getVendorName(product.seller)}</strong>
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{product.title}</h1>
          <p className="mt-4 sm:mt-6 text-mute leading-relaxed">{product.description}</p>

          {variants.length > 0 ? (
            <ProductVariantPicker
              productId={product.id}
              variants={variants}
              basePriceCents={product.price}
              loggedIn={!!user}
            />
          ) : (
            <>
              <p className="mt-6 sm:mt-8 text-3xl font-black">{priceLabel}</p>
              {user ? (
                <Link
                  href={`/checkout/${product.id}`}
                  className="mt-8 inline-flex items-center justify-center bg-accent text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-accent-hover transition-all w-full sm:w-auto"
                >
                  Jetzt kaufen
                </Link>
              ) : (
                <a
                  href="/handler/sign-in"
                  className="mt-8 inline-flex items-center justify-center bg-accent text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-accent-hover transition-all w-full sm:w-auto"
                >
                  Einloggen und kaufen
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
