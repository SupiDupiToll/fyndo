import { getDemoMarketplaceProducts } from "@/lib/demo-data";
import { DemoProductCard } from "@/components/demo/demo-product-card";

export const dynamic = "force-dynamic";

export default async function DemoProductsPage(props: { searchParams?: Promise<{ q?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const query = searchParams?.q?.trim() ?? "";
  const products = getDemoMarketplaceProducts(query);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">
          {query ? <>Suche: &ldquo;{query}&rdquo;</> : "Produkte"}
          <span className="text-mute font-normal text-sm ml-2">({products.length} Treffer)</span>
        </h1>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-mute">Keine Produkte gefunden.</p>
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
