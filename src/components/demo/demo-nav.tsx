import Link from "next/link";

export function DemoNav() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-line">
      <nav className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/demos/marketplace" className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Fyndo<span className="text-accent">.</span>
        </Link>

        <form action="/demos/marketplace/products" method="GET" className="hidden sm:flex items-center flex-1 max-w-md mx-4 lg:mx-10 bg-surf rounded-full px-5 py-2 border border-transparent focus-within:border-accent/30 transition-colors">
          <i className="fa-solid fa-magnifying-glass text-mute text-sm"></i>
          <input name="q" type="text" placeholder="Wonach suchst du?" className="bg-transparent border-none outline-none ml-3 w-full text-sm" />
        </form>

        <div className="hidden sm:flex items-center gap-4 lg:gap-6 text-sm font-semibold">
          <Link href="/demos/marketplace/products" className="hover:text-accent transition-colors">Marktplatz</Link>
          <Link href="/demos/marketplace/concierge" className="hover:text-accent transition-colors">Concierge</Link>
          <Link href="/demos/marketplace/gift-cards" className="hover:text-accent transition-colors">Gutschein</Link>
          <Link href="/demos/marketplace/bestellungen" className="hover:text-accent transition-colors">Bestellungen</Link>
          <Link href="/demos/marketplace/admin" className="text-accent hover:text-blue-700 transition-colors">Admin</Link>
        </div>

        <div className="flex sm:hidden items-center gap-2">
          <Link href="/demos/marketplace/products" className="rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-surf transition-colors">
            Marktplatz
          </Link>
          <Link href="/demos/marketplace/admin" className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-accent hover:bg-surf transition-colors">
            Admin
          </Link>
        </div>
      </nav>
    </header>
  );
}
