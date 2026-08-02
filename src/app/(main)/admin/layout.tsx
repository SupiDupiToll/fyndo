import { requireSellerOrSuperAdmin } from "@/lib/auth";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user;
  try { user = await requireSellerOrSuperAdmin(); }
  catch { return <p className="max-w-[1200px] mx-auto px-6 py-16 text-center text-mute">Kein Zugriff.</p>; }

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        <aside className="flex md:flex-col gap-1 overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:w-56 md:shrink-0 pb-2 md:pb-0">
          <Link href="/admin" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Dashboard</Link>
          <Link href="/admin/products" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Produkte</Link>
          <Link href="/admin/pos" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">POS-Kasse</Link>
          <a href={`/pos/${encodeURIComponent(user.sellerName ?? user.displayName)}`} target="_blank" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">POS-Kiosk ↗</a>
          {isSuperAdmin && <Link href="/admin/concierge" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Concierge</Link>}
          <Link href="/admin/settings" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Zahlungen</Link>
          {isSuperAdmin && <Link href="/admin/sellers" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Verkäufer</Link>}
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
