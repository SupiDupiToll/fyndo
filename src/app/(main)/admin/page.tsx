import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await requireSellerOrSuperAdmin();
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const productFilter = isSuperAdmin ? {} : { sellerId: user.id };

  const [productCount, orderCount, totalRevenue, recentOrders] = await Promise.all([
    prisma.product.count({ where: { ...productFilter } }),
    prisma.order.count({ where: isSuperAdmin ? {} : { product: { sellerId: user.id } } }),
    prisma.order.aggregate({
      where: { status: "PAID", ...(isSuperAdmin ? {} : { product: { sellerId: user.id } }) },
      _sum: { amountCents: true },
    }),
    prisma.order.findMany({
      where: isSuperAdmin ? {} : { product: { sellerId: user.id } },
      include: { product: { select: { title: true } }, user: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const tpoCount = isSuperAdmin
    ? await prisma.thirdPartyOrder.count()
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-mute mt-1">Willkommen, {user.displayName}.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Produkte</p>
          <p className="text-3xl font-bold mt-1">{productCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Bestellungen</p>
          <p className="text-3xl font-bold mt-1">{orderCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-mute font-medium">Umsatz</p>
          <p className="text-3xl font-bold mt-1">{formatEuro(totalRevenue._sum.amountCents ?? 0)}</p>
        </div>
        {tpoCount !== null && (
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm text-mute font-medium">Concierge-Anfragen</p>
            <p className="text-3xl font-bold mt-1">{tpoCount}</p>
          </div>
        )}
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Letzte Bestellungen</h2>
          <a href="/admin/products" className="text-sm text-accent hover:underline font-medium">Alle Produkte</a>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-mute text-sm">Noch keine Bestellungen.</p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-line bg-white px-5 py-3">
                <div>
                  <p className="font-medium text-sm">{o.product.title}</p>
                  <p className="text-xs text-mute">{o.user.displayName} &middot; {new Date(o.createdAt).toLocaleDateString("de-DE")}</p>
                </div>
                <span className="text-sm font-bold">{formatEuro(o.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
