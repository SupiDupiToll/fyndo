import { PosOrderBoard } from "@/components/pos/pos-order-board";

export const dynamic = "force-dynamic";

export default function DemoPosBoardPage() {
  return (
    <PosOrderBoard vendorName="Sweet Cream" demo readyHoldMinutes={2} />
  );
}
