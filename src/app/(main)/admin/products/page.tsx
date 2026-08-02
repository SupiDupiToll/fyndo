import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ProductListAdmin } from "@/components/pos/admin-product-list";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const user = await requireSellerOrSuperAdmin();
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const products = await prisma.product.findMany({
    where: isSuperAdmin ? {} : { sellerId: user.id },
    include: { seller: { select: { sellerName: true, displayName: true } }, _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produkte</h1>
          <p className="text-sm text-mute mt-1">
            Mit dem POS-Schalter legst du fest, welche Produkte im Kiosk auf{" "}
            <a href={`/pos/${encodeURIComponent(user.sellerName ?? user.displayName)}`} target="_blank" className="text-accent hover:underline">
              /pos/{user.sellerName ?? user.displayName}
            </a>{" "}
            angezeigt werden.
          </p>
        </div>
        <Link href="/admin/products/create" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
          + Neu
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-mute">Noch keine Produkte.</p>
      ) : (
        <ProductListAdmin
          showSeller={isSuperAdmin}
          products={products.map((p) => ({
            id: p.id,
            title: p.title,
            price: p.price,
            imageUrl: p.imageUrl,
            isActive: p.isActive,
            posVisible: p.posVisible,
            posOnly: p.posOnly,
            ordersCount: p._count.orders,
            sellerLabel: p.seller.sellerName ?? p.seller.displayName,
          }))}
        />
      )}
    </div>
  );
}
