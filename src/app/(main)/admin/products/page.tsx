import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import Link from "next/link";

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
        <h1 className="text-3xl font-bold tracking-tight">Produkte</h1>
        <Link href="/admin/products/create" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
          + Neu
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-mute">Noch keine Produkte.</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-tile">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-2" /> : <div className="flex h-full items-center justify-center text-xs text-mute">Bild</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{p.title}</p>
                <p className="text-sm text-mute">{formatEuro(p.price)} &middot; {p._count.orders} Bestellungen</p>
                {!isSuperAdmin && <p className="text-xs text-mute">Status: {p.isActive ? "Aktiv" : "Inaktiv"}</p>}
              </div>
              {isSuperAdmin && <span className="text-xs text-mute">{p.seller.sellerName ?? p.seller.displayName}</span>}
              <span className={`text-xs font-bold rounded-full px-3 py-1 ${p.isActive ? "bg-green-50 text-green-700" : "bg-gray-50 text-mute"}`}>
                {p.isActive ? "Aktiv" : "Inaktiv"}
              </span>
              <Link href={`/admin/products/${p.id}/edit`} className="rounded-lg border border-line px-4 py-2 text-sm font-bold hover:bg-surf transition-colors">
                Bearbeiten
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
