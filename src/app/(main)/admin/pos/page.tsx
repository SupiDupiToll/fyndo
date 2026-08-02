import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { PosAdminDashboard } from "@/components/pos/pos-admin-dashboard";
import { getVendorName } from "@/lib/vendor";

export const dynamic = "force-dynamic";

export default async function AdminPosPage() {
  const user = await requireSellerOrSuperAdmin();

  return (
    <PosAdminDashboard vendorName={getVendorName({ sellerName: user.sellerName, displayName: user.displayName })} />
  );
}
