import { getDemoProducts } from "@/lib/demo-data";
import { DemoProductCard } from "@/components/demo/demo-product-card";

export const dynamic = "force-dynamic";

export default function DemoMarketplaceHomePage() {
  const products = getDemoProducts();

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Marktplatz</h1>
        <p className="text-mute mt-2">Alle Produkte auf einen Blick.</p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-mute">Noch keine Produkte vorhanden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <DemoProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
