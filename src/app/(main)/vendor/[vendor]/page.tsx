import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatEuro } from "@/lib/format";
import { getVendorName } from "@/lib/vendor";
import { notFound } from "next/navigation";
import { parseVariants } from "@/lib/product-variants";
import { getProductPriceLabel } from "@/lib/shop";

export const dynamic = "force-dynamic";

export default async function VendorPage({
  params,
}: {
  params: Promise<{ vendor: string }>;
}) {
  const { vendor } = await params;
  const vendorName = decodeURIComponent(vendor).trim();

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      posOnly: false,
      seller: {
        is: {
          OR: [{ sellerName: vendorName }, { displayName: vendorName }],
        },
      },
    },
    include: {
      seller: { select: { sellerName: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (products.length === 0) notFound();

  const resolvedVendorName = getVendorName(products[0].seller);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{resolvedVendorName}</h1>
        <p className="text-mute mt-2">Alle Produkte von {resolvedVendorName}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => {
          const cardVariants = product.kind === "PRODUCT" ? (parseVariants(product.variants) ?? []) : [];
          return (
          <div key={product.id} className="border border-line rounded-2xl p-4 hover:shadow-lg transition-all bg-white flex flex-col">
            <Link href={`/products/${product.id}`} className="block">
              <div className="aspect-square rounded-xl overflow-hidden bg-surf mb-4">
                {product.imageUrl ? (
                  <img className="w-full h-full object-contain p-4" src={product.imageUrl} alt={product.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-mute text-sm">Kein Bild</div>
                )}
              </div>
              <h3 className="font-bold">{product.title}</h3>
            </Link>
            <p className="text-lg font-black mt-2">{getProductPriceLabel(product)}</p>
            {cardVariants.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {cardVariants.slice(0, 3).map((v) => (
                  <span key={v.id} className="rounded-full border border-line bg-surf px-2 py-0.5 text-[11px] font-medium text-mute">
                    {v.name} · {formatEuro(v.priceCents)}
                  </span>
                ))}
                {cardVariants.length > 3 && (
                  <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-mute">
                    +{cardVariants.length - 3}
                  </span>
                )}
              </div>
            )}
            <Link href={`/checkout/${product.id}`} className="mt-4 block w-full text-center bg-accent text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">
              Jetzt kaufen
            </Link>
          </div>
          );
        })}
      </div>
    </div>
  );
}
