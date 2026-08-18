import { DemoNav } from "@/components/demo/demo-nav";
import { Footer } from "@/components/footer";

export default function DemoMarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
