import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatEuro } from "@/lib/format";
import { prisma } from "@/lib/db";
import { verifyRbankPayment } from "@/lib/rbank";
import { sendThirdPartyOrderPaidNotification } from "@/lib/ntfy";

export const dynamic = "force-dynamic";

export default async function ThirdPartyOrderCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ thirdPartyOrderId?: string; token?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Drittshop-Zahlung</h1>
        <p className="mt-2 text-mute">Bitte einloggen, um die Zahlung zu sehen.</p>
        <a href="/handler/sign-in" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Einloggen
        </a>
      </div>
    );
  }

  const thirdPartyOrderId = params.thirdPartyOrderId ?? "";
  const token = params.token ?? "";

  if (!thirdPartyOrderId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold">Keine Bestellung gefunden</h1>
        <Link href="/bestellungen" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Zurück
        </Link>
      </div>
    );
  }

  const order = await prisma.thirdPartyOrder.findUnique({ where: { id: thirdPartyOrderId } });

  if (!order || order.userId !== user.id) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold text-red-600">Bestellung nicht gefunden</h1>
        <Link href="/bestellungen" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Meine Bestellungen
        </Link>
      </div>
    );
  }

  let message = "Zahlung noch nicht bestätigt.";
  let success = false;

  if (order.status === "DONE") {
    message = "Die Bestellung wurde bereits erledigt.";
    success = true;
  } else if (order.status === "ORDERED" && order.amountCents) {
    message = "Zahlung ist bestätigt.";
    success = true;
  } else if (token && order.paymentToken === token) {
    const verification = await verifyRbankPayment(token);

    if (
      verification.status === "COMPLETED" &&
      verification.amount === order.amountCents &&
      verification.metadata.thirdPartyOrderId === order.id
    ) {
      const updated = await prisma.thirdPartyOrder.updateMany({
        where: { id: order.id, status: "QUOTED", paymentToken: token },
        data: { status: "ORDERED", orderedAt: new Date() },
      });

      if (updated.count === 1) {
        await sendThirdPartyOrderPaidNotification({
          buyerEmail: user.email,
          productUrl: order.productUrl,
          shopName: order.shopName,
          shopHost: order.shopHost,
          amountCents: order.amountCents ?? verification.amount,
        }).catch((err) => console.error("NTFY failed:", err));
      }

      message = "Zahlung bestätigt. Vielen Dank!";
      success = true;
    } else {
      message = `Checkout-Status: ${verification.status}`;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{order.shopName}</h1>
      <div className="mt-8 p-8 bg-white rounded-3xl border border-line shadow-sm max-w-md">
        <p className="text-mute">{message}</p>
        <p className={success ? "mt-3 text-3xl font-black text-green-600" : "mt-3 text-3xl font-black text-red-600"}>
          {typeof order.amountCents === "number" ? formatEuro(order.amountCents) : "Preis offen"}
        </p>
      </div>
      <div className="mt-8 flex gap-4">
        <Link href="/bestellungen" className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Zurück
        </Link>
      </div>
    </div>
  );
}
