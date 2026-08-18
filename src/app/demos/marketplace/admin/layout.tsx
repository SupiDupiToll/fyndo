import Link from "next/link";

export default function DemoAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        <aside className="flex md:flex-col gap-1 overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:w-56 md:shrink-0 pb-2 md:pb-0">
          <Link href="/demos/marketplace/admin" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Dashboard</Link>
          <Link href="/demos/marketplace/admin/products" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Produkte</Link>
          <Link href="/demos/marketplace/admin/pos" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">POS-Kasse</Link>
          <a href="/demos/pos" target="_blank" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">POS-Kiosk ↗</a>
          <Link href="/demos/marketplace/admin/concierge" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Concierge</Link>
          <Link href="/demos/marketplace/admin/settings" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Zahlungen</Link>
          <Link href="/demos/marketplace/admin/sellers" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-surf transition-colors">Verkäufer</Link>
        </aside>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white px-3 py-1 text-[11px] font-black uppercase tracking-widest">
              <i className="fa-solid fa-flask" />
              Demo Admin
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
