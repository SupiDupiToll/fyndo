import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { prisma } from "@/lib/db";
import { createRbankPayment } from "@/lib/rbank";
import { formatEuro } from "@/lib/format";
import { isDemoUser } from "@/lib/demo";
import { formatGiftCardCode } from "@/lib/gift-card";
import {
  getVoucherDiscountAmountForConfig,
  getVoucherDiscountType,
  getVoucherDiscountValue,
  getVoucherAmounts,
  getVoucherPaymentAmount,
  getVoucherSavingsLabel,
} from "@/lib/shop";
import { findVariant } from "@/lib/product-variants";

export async function POST(request: NextRequest) {
  let productId = "";
  let amountCents = 0;
  let variantId: string | undefined;
  let giftCardCode: string | undefined;
  const appUrl = getAppUrl();
  const configuredRedirectBase = `${appUrl}/checkout/complete`;
  const configuredCancelUrl = `${appUrl}?cancelled=1`;

  try {
    const body = (await request.json()) as { productId?: string; amountCents?: number; variantId?: string; giftCardCode?: string };
    productId = String(body.productId ?? "");
    amountCents = Number(body.amountCents ?? 0);
    variantId = typeof body.variantId === "string" ? body.variantId.trim() || undefined : undefined;
    giftCardCode = typeof body.giftCardCode === "string" ? body.giftCardCode.trim() || undefined : undefined;
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
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
    }

    const selectedVariant =
      product.kind === "PRODUCT" ? findVariant(product, variantId ?? null) : null;

    if (product.kind === "PRODUCT" && variantId && !selectedVariant) {
      return NextResponse.json({ error: "Variante nicht gefunden." }, { status: 400 });
    }

    const resolvedAmount =
      product.kind === "VOUCHER" ? amountCents : (selectedVariant?.priceCents ?? product.price);

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
    } else if (selectedVariant) {
      if (resolvedAmount !== selectedVariant.priceCents) {
        return NextResponse.json({ error: "Variantenpreis stimmt nicht." }, { status: 400 });
      }
    } else if (resolvedAmount !== product.price) {
      return NextResponse.json({ error: "Produktpreis stimmt nicht." }, { status: 400 });
    }

    let basePaymentAmount = product.kind === "VOUCHER"
      ? getVoucherPaymentAmount(resolvedAmount, product)
      : resolvedAmount;

    let giftCardDeduction = 0;

    if (giftCardCode) {
      const formattedCode = formatGiftCardCode(giftCardCode);
      const gc = await prisma.giftCard.findUnique({ where: { code: formattedCode } });

      if (!gc || gc.status !== "ACTIVE" || gc.remainingBalance <= 0) {
        return NextResponse.json({ error: "Ungültiger oder aufgebrauchter Gutscheincode." }, { status: 400 });
      }

      giftCardDeduction = Math.min(gc.remainingBalance, basePaymentAmount);
      basePaymentAmount -= giftCardDeduction;
    }

    const orderData = {
      userId: user.id,
      productId: product.id,
      amountCents: basePaymentAmount,
      voucherFaceValueCents: product.kind === "VOUCHER" ? resolvedAmount : null,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
      buyerName: user.displayName,
      buyerEmail: user.email,
      giftCardCodeUsed: giftCardCode ? formatGiftCardCode(giftCardCode) : null,
      giftCardDeduction: giftCardDeduction > 0 ? giftCardDeduction : null,
    };

    if (basePaymentAmount <= 0) {
      const order = await prisma.order.create({
        data: { ...orderData, status: "PAID" },
      });

      if (giftCardDeduction > 0 && order.giftCardCodeUsed) {
        await prisma.giftCard.update({
          where: { code: order.giftCardCodeUsed },
          data: { remainingBalance: { decrement: giftCardDeduction } },
        });
      }

      await prisma.user.update({
        where: { id: product.sellerId },
        data: { sellerBalanceCents: { increment: basePaymentAmount + giftCardDeduction } },
      }).catch(() => {});

      return NextResponse.json({
        redirectUrl: `${configuredRedirectBase}?orderId=${order.id}`,
      });
    }

    const pendingOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        productId: product.id,
        status: "PENDING",
        amountCents: basePaymentAmount,
        variantId: selectedVariant?.id ?? null,
      },
    });

    const order = pendingOrder ?? await prisma.order.create({
      data: { ...orderData, status: "PENDING" },
    });

    const redirectUrl = `${configuredRedirectBase}?orderId=${order.id}`;
    const cancelUrl = configuredCancelUrl;

    const description = product.kind === "VOUCHER"
      ? `${product.title} ${formatEuro(resolvedAmount)} (${getVoucherSavingsLabel(resolvedAmount, product) ?? "kein Rabatt"}) - ${user.displayName}`
      : `${product.title}${selectedVariant ? ` (${selectedVariant.name})` : ""} - ${user.displayName}`;

    const session = await createRbankPayment({
      amount: basePaymentAmount,
      description: giftCardDeduction > 0 ? `${description} (Gutschein: ${formatEuro(giftCardDeduction)})` : description,
      redirectUrl,
      cancelUrl,
      metadata: {
        orderId: order.id,
        productId: product.id,
        userId: user.id,
      },
    });

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
