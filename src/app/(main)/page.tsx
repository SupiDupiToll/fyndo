import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatEuro } from "@/lib/format";

export const dynamic = "force-dynamic";

const VENDOR_NAME = "RundiShop";

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      seller: { select: { sellerName: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Marktplatz</h1>
        <p className="text-mute mt-2">Alle Produkte auf einen Blick.</p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-mute">Noch keine Produkte vorhanden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="group border border-line rounded-2xl p-4 hover:shadow-lg transition-all bg-white flex flex-col">
              <Link href={`/products/${product.id}`} className="block">
                <div className="aspect-square rounded-xl overflow-hidden bg-surf mb-4">
                  {product.imageUrl ? (
                    <img className="w-full h-full object-contain p-4 transition-transform group-hover:scale-105" src={product.imageUrl} alt={product.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-mute text-sm">Kein Bild</div>
                  )}
                </div>
                <h3 className="font-bold group-hover:text-accent transition-colors line-clamp-2">{product.title}</h3>
              </Link>
              <p className="text-xl font-black mt-2">{formatEuro(product.price)}</p>
              <Link href="/vendor/RundiShop" className="text-xs text-mute hover:text-accent mt-1 block transition-colors">
                {VENDOR_NAME}
              </Link>
              <div className="mt-4">
                <Link
                  href={`/checkout/${product.id}`}
                  className="block w-full text-center bg-accent text-white py-3 rounded-xl font-bold hover:bg-accent-hover transition-colors"
                >
                  Jetzt kaufen
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
