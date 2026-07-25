import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-white border-t border-line py-12 mt-20">
      <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-mute">
        <p>© 2026 Rui Xie</p>
        <div className="flex gap-8">
          <Link href="/products" className="hover:text-ink">
            Marktplatz
          </Link>
          <Link href="/concierge" className="hover:text-ink">
            Concierge
          </Link>
          <Link href="/bestellungen" className="hover:text-ink">
            Bestellungen
          </Link>
        </div>
      </div>
    </footer>
  );
}
