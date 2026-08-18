import { DemoToggle } from "@/components/demo/demo-toggle";

export default function DemosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoToggle />
      {children}
    </>
  );
}
