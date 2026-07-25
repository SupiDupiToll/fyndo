import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAppUrl, getRbankConfig } from "@/lib/env";
import { prisma } from "@/lib/db";
import { createRbankPayment } from "@/lib/rbank";
import { formatEuro } from "@/lib/format";
import { isDemoUser } from "@/lib/demo";
import {
  getVoucherDiscountAmountForConfig,
  getVoucherDiscountType,
  getVoucherDiscountValue,
  getVoucherAmounts,
  getVoucherPaymentAmount,
  getVoucherSavingsLabel,
} from "@/lib/shop";

export async function POST(request: NextRequest) {
  let productId = "";
  let amountCents = 0;
  const appUrl = getAppUrl();
  const configuredRedirectBase = `${appUrl}/checkout/complete`;
  const configuredCancelUrl = `${appUrl}?cancelled=1`;

  try {
    const body = (await request.json()) as { productId?: string; amountCents?: number };
    productId = String(body.productId ?? "");
    amountCents = Number(body.amountCents ?? 0);
  } catch {
    return NextResponse.json({ error: "Ungueltige Eingabedaten." }, { status: 400 });
  }

  try {
    const user = await requireUser();

    if (isDemoUser(user)) {
      return NextResponse.json({ error: "Demo-Nutzer duerfen nichts bestellen." }, { status: 403 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { seller: true },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
    }

    const resolvedAmount = product.kind === "VOUCHER" ? amountCents : product.price;

    if (!Number.isInteger(resolvedAmount) || resolvedAmount <= 0) {
      return NextResponse.json({ error: "Ungueltiger Betrag." }, { status: 400 });
    }

    const voucherDiscountType = product.kind === "VOUCHER" ? getVoucherDiscountType(product) : null;
    const voucherDiscountValue = product.kind === "VOUCHER" ? getVoucherDiscountValue(product) : 0;

    if (product.kind === "VOUCHER") {
      const allowedAmounts = getVoucherAmounts(product);
      const discountAmount = getVoucherDiscountAmountForConfig(
        resolvedAmount,
        voucherDiscountType ?? "FIXED",
        voucherDiscountValue,
      );

      if (!allowedAmounts.includes(resolvedAmount)) {
        return NextResponse.json({ error: "Dieser Gutschein-Betrag ist nicht verfuegbar." }, { status: 400 });
      }

      if (discountAmount <= 0 || resolvedAmount <= discountAmount) {
        return NextResponse.json({ error: "Der Gutschein-Rabatt ist fuer diesen Betrag zu hoch." }, { status: 400 });
      }
    } else if (resolvedAmount !== product.price) {
      return NextResponse.json({ error: "Produktpreis stimmt nicht." }, { status: 400 });
    }

    const paymentAmount = product.kind === "VOUCHER"
      ? getVoucherPaymentAmount(resolvedAmount, product)
      : product.price;

    const pendingOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        productId: product.id,
        status: "PENDING",
        amountCents: paymentAmount,
      },
    });

    const order = pendingOrder ?? await prisma.order.create({
      data: {
        userId: user.id,
        productId: product.id,
        amountCents: paymentAmount,
        voucherFaceValueCents: product.kind === "VOUCHER" ? resolvedAmount : null,
        buyerName: user.displayName,
        buyerEmail: user.email,
        status: "PENDING",
      },
    });

    const redirectUrl = `${configuredRedirectBase}?orderId=${order.id}`;
    const cancelUrl = configuredCancelUrl;

    const description = product.kind === "VOUCHER"
      ? `${product.title} ${formatEuro(resolvedAmount)} (${getVoucherSavingsLabel(resolvedAmount, product) ?? "kein Rabatt"}) - ${user.displayName}`
      : `${product.title} - ${user.displayName}`;

    const sellerConfig = product.seller.rbankMerchantId && product.seller.rbankMerchantSecret
      ? {
          apiUrl: product.seller.rbankApiUrl ?? getRbankConfig().apiUrl,
          merchantId: product.seller.rbankMerchantId,
          merchantSecret: product.seller.rbankMerchantSecret,
        }
      : undefined;

    const session = await createRbankPayment(
      {
        amount: paymentAmount,
        description,
        redirectUrl,
        cancelUrl,
        metadata: {
          orderId: order.id,
          productId: product.id,
          userId: user.id,
        },
      },
      sellerConfig,
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentToken: session.token },
    });

    return NextResponse.json({ paymentUrl: session.paymentUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 });
    }

    console.error("Checkout create failed:", error);
    return NextResponse.json({ error: "Checkout konnte nicht gestartet werden." }, { status: 500 });
  }
}
