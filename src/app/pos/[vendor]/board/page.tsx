import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { PosOrderBoard } from "@/components/pos/pos-order-board";
import { getVendorName } from "@/lib/vendor";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PosBoardPage({
  params,
}: {
  params: Promise<{ vendor: string }>;
}) {
  const { vendor } = await params;
  const vendorName = decodeURIComponent(vendor).trim();

  const user = await getCurrentUser();

  if (!user) {
    redirect(
      `/handler/sign-in?after_auth_return_to=${encodeURIComponent(`/pos/${encodeURIComponent(vendorName)}/board`)}`,
    );
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
    select: { id: true, sellerName: true, displayName: true },
  });

  if (!seller) notFound();

  const resolvedVendorName = getVendorName({
    sellerName: seller.sellerName,
    displayName: seller.displayName,
  });

  return <PosOrderBoard vendorName={resolvedVendorName} />;
}
