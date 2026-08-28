import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { PosKiosk } from "@/components/pos/pos-kiosk";
import { getVendorName } from "@/lib/vendor";
import { getCurrentUser } from "@/lib/auth";
import { getRbankConfig } from "@/lib/env";
import { parsePosSettings } from "@/lib/pos-settings";

export const dynamic = "force-dynamic";

export default async function PosPage({
  params,
}: {
  params: Promise<{ vendor: string }>;
}) {
  const { vendor } = await params;
  const vendorName = decodeURIComponent(vendor).trim();

  const user = await getCurrentUser();

  if (!user) {
    redirect(`/handler/sign-in?after_auth_return_to=${encodeURIComponent(`/pos/${encodeURIComponent(vendorName)}`)}`);
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isOwnVendor =
    user.sellerName?.trim().toLowerCase() === vendorName.toLowerCase() ||
    user.displayName?.trim().toLowerCase() === vendorName.toLowerCase();
  if (!isSuperAdmin && !isOwnVendor) notFound();

  const seller = await prisma.user.findFirst({
    where: {
      OR: [
        { sellerName: { equals: vendorName, mode: "insensitive" } },
        { displayName: { equals: vendorName, mode: "insensitive" } },
      ],
    },
    select: { id: true, sellerName: true, displayName: true, posSettings: true },
  });

  if (!seller) notFound();

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      kind: "PRODUCT",
      posVisible: true,
      sellerId: seller.id,
    },
    include: {
      seller: { select: { sellerName: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (products.length === 0) notFound();

  const resolvedVendorName = getVendorName(products[0].seller);
  const posSettings = parsePosSettings(seller.posSettings);

  const toPosProduct = (p: (typeof products)[number]) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    isContainer: p.isContainer,
    isTopping: p.isTopping,
    variants: Array.isArray(p.variants)
      ? (p.variants as { id: string; name: string; priceCents: number }[])
      : [],
  });

  const toppings = products.filter((p) => p.isTopping).map(toPosProduct);
  const gridProducts = products.filter((p) => !p.isTopping).map(toPosProduct);

  if (gridProducts.length === 0) notFound();

  return (
    <PosKiosk
      vendorName={resolvedVendorName}
      settings={posSettings}
      products={gridProducts}
      toppings={toppings}
      rbankBaseUrl={getRbankConfig().apiUrl}
    />
  );
}
