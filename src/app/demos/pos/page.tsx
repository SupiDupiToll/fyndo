import { PosKiosk } from "@/components/pos/pos-kiosk";
import { getDemoPosProducts, type DemoProduct } from "@/lib/demo-data";
import { POS_SETTINGS_DEFAULTS } from "@/lib/pos-settings";

export const dynamic = "force-dynamic";

function toPosProduct(p: DemoProduct) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    isContainer: p.isContainer,
    isTopping: p.isTopping,
    variants: Array.isArray(p.variants) ? p.variants : [],
  };
}

export default function DemoPosPage() {
  const { products, toppings } = getDemoPosProducts();
  const settings = {
    ...POS_SETTINGS_DEFAULTS,
    lockScreenEnabled: false,
    showOnLoad: false,
    idleTimeoutSeconds: 600,
  };

  return (
    <PosKiosk
      vendorName="Sweet Cream"
      settings={settings}
      products={products.map(toPosProduct)}
      toppings={toppings.map(toPosProduct)}
      demo
    />
  );
}
