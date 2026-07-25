import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatEuro } from "@/lib/format";
import { prisma } from "@/lib/db";
import { verifyRbankPayment } from "@/lib/rbank";
import { getRbankConfig } from "@/lib/env";
import { generateGiftCardCode } from "@/lib/gift-card";

export const dynamic = "force-dynamic";

export default async function GiftCardCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Rückkehr</h1>
        <p className="mt-2 text-mute">Bitte einloggen.</p>
        <a href="/handler/sign-in" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">Einloggen</a>
      </div>
    );
  }

  const id = params.id ?? "";
  const token = params.token ?? "";

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold">Kein Gutschein gefunden</h1>
        <Link href="/" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">Zum Shop</Link>
      </div>
    );
  }

  const giftCard = await prisma.giftCard.findUnique({ where: { id } });
  if (!giftCard || giftCard.buyerId !== user.id) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-3xl font-bold text-red-600">Gutschein nicht gefunden</h1>
        <Link href="/" className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">Zum Shop</Link>
      </div>
    );
  }

  let message = "Zahlung noch nicht bestätigt.";
  let success = false;
  let code: string | null = giftCard.code;

  if (giftCard.status === "ACTIVE" && code) {
    message = "Gutschein ist bereits aktiviert.";
    success = true;
  } else if (token && giftCard.paymentToken === token) {
    const verification = await verifyRbankPayment(token);

    if (verification.status === "COMPLETED" && verification.amount === giftCard.amountCents) {
      const generatedCode = generateGiftCardCode();

      await prisma.giftCard.update({
        where: { id },
        data: {
          status: "ACTIVE",
          code: generatedCode,
          activatedAt: new Date(),
        },
      });

      const webhookUrl = process.env.NTFY_WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: "POST",
          headers: {
            Title: "Geschenkgutschein gekauft",
            Priority: "default",
            Tags: "gift",
          },
          body: [
            `${user.displayName} (${user.email}) hat einen Geschenkgutschein gekauft:`,
            `Betrag: ${formatEuro(giftCard.amountCents)}`,
            `Code: ${generatedCode}`,
            giftCard.message ? `Nachricht: ${giftCard.message}` : null,
          ].filter(Boolean).join("\n"),
          cache: "no-store",
        }).catch(() => {});
      }

      code = generatedCode;
      message = "Zahlung bestätigt. Dein Gutschein-Code:";
      success = true;
    } else {
      message = `Status: ${verification.status}`;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Geschenkgutschein</h1>
      <div className="mt-8 p-8 bg-white rounded-3xl border border-line shadow-sm max-w-md">
        <p className="text-mute">{message}</p>
        {code && (
          <p className="mt-4 text-2xl font-black tracking-widest text-accent select-all">
            {code}
          </p>
        )}
        <p className={success ? "mt-3 text-3xl font-black text-green-600" : "mt-3 text-3xl font-black text-red-600"}>
          {formatEuro(giftCard.amountCents)}
        </p>
      </div>
      <div className="mt-8 flex gap-4">
        <Link href="/" className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Zum Shop
        </Link>
        <Link href="/gift-cards" className="rounded-full border border-line px-8 py-3 text-sm font-bold text-ink hover:bg-surf transition-all">
          Weiteren kaufen
        </Link>
      </div>
    </div>
  );
}
