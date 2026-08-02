import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PosKiosk } from "@/components/pos/pos-kiosk";
import { getVendorName } from "@/lib/vendor";

export const dynamic = "force-dynamic";

export default async function PosPage({
  params,
}: {
  params: Promise<{ vendor: string }>;
}) {
  const { vendor } = await params;
  const vendorName = decodeURIComponent(vendor).trim();

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      kind: "PRODUCT",
      posVisible: true,
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
    <PosKiosk
      vendorName={resolvedVendorName}
      products={products.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        imageUrl: p.imageUrl,
        price: p.price,
        variants: Array.isArray(p.variants)
          ? (p.variants as { id: string; name: string; priceCents: number }[])
          : [],
      }))}
    />
  );
}
