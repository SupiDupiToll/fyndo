import { notFound } from "next/navigation";
import { getDemoVendorProducts } from "@/lib/demo-data";
import { DemoProductCard } from "@/components/demo/demo-product-card";

export const dynamic = "force-dynamic";

export default async function DemoVendorPage({ params }: { params: Promise<{ vendor: string }> }) {
  const { vendor } = await params;
  const vendorName = decodeURIComponent(vendor).trim();
  const products = getDemoVendorProducts(vendorName);

  if (products.length === 0) notFound();

  const resolvedVendorName = products[0].seller.sellerName ?? products[0].seller.displayName ?? vendorName;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{resolvedVendorName}</h1>
        <p className="text-mute mt-2">Alle Produkte von {resolvedVendorName}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <DemoProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
