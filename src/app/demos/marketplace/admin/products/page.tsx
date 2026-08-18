import { demoProducts, demoPosProducts } from "@/lib/demo-data";
import { DemoAdminProductList } from "@/components/demo/demo-admin-product-list";

export const dynamic = "force-dynamic";

export default function DemoAdminProductsPage() {
  const products = [...demoProducts, ...demoPosProducts];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produkte</h1>
          <p className="text-sm text-mute mt-1">
            Mit dem POS-Schalter legst du fest, welche Produkte im Kiosk angezeigt werden. (Demo – nur Ansicht)
          </p>
        </div>
        <span className="rounded-xl bg-tile px-5 py-2.5 text-sm font-bold text-mute cursor-not-allowed">+ Neu</span>
      </div>

      <DemoAdminProductList products={products} />
    </div>
  );
}
