import type { Product, VoucherDiscountType } from "@/generated/prisma/client";
import { formatEuro } from "@/lib/format";

export const DEFAULT_VOUCHER_STEP_CENTS = 100;

function toInt(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseAllowedAmounts(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function getVoucherAmounts(product: Product) {
  if (product.voucherMode === "FIXED") {
    const amounts = Array.isArray(product.voucherAmounts)
      ? product.voucherAmounts
          .map((value) => toInt(value))
          .filter((value): value is number => value !== null)
      : [];

    return amounts.filter((value, index) => amounts.indexOf(value) === index);
  }

  const min = product.voucherMinCents;
  const max = product.voucherMaxCents;
  const step = product.voucherStepCents ?? DEFAULT_VOUCHER_STEP_CENTS;

  if (typeof min !== "number" || typeof max !== "number" || !Number.isInteger(step) || step <= 0) {
    return [];
  }

  const amounts: number[] = [];
  for (let current = min; current <= max; current += step) {
    amounts.push(current);
  }

  return amounts;
}

export function getVoucherDiscountCents(product: Product) {
  if (product.kind !== "VOUCHER") return 0;

  const type = product.voucherDiscountType ?? "FIXED";
  const value = product.voucherDiscountValue ?? 10;

  if (type === "PERCENT") {
    return Number.isFinite(value) && value > 0 && value < 100 ? value : 0;
  }

  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function getVoucherDiscountType(product: Product): VoucherDiscountType {
  return product.voucherDiscountType ?? "FIXED";
}

export function getVoucherDiscountValue(product: Product) {
  return product.voucherDiscountValue ?? 10;
}

export function getVoucherDiscountAmountForConfig(
  faceValueCents: number,
  discountType: VoucherDiscountType,
  discountValue: number,
) {
  if (discountType === "PERCENT") {
    if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue >= 100) return 0;
    return Math.max(Math.round((faceValueCents * discountValue) / 100), 0);
  }

  return Number.isInteger(discountValue) && discountValue > 0 ? discountValue : 0;
}

export function getVoucherDiscountAmount(faceValueCents: number, product: Product) {
  if (product.kind !== "VOUCHER") return 0;
  const type = getVoucherDiscountType(product);
  const value = getVoucherDiscountValue(product);
  return getVoucherDiscountAmountForConfig(faceValueCents, type, value);
}

export function getVoucherPaymentAmount(faceValueCents: number, product: Product) {
  const discountAmount = getVoucherDiscountAmount(faceValueCents, product);
  return Math.max(faceValueCents - discountAmount, 1);
}

export function getVoucherSavingsLabelForConfig(
  faceValueCents: number,
  discountType: VoucherDiscountType,
  discountValue: number,
) {
  const discountAmount = getVoucherDiscountAmountForConfig(faceValueCents, discountType, discountValue);

  if (discountAmount <= 0) return null;

  if (discountType === "PERCENT") {
    return `spare ${discountValue}% = ${formatEuro(discountAmount)}`;
  }

  return `spare ${formatEuro(discountAmount)}`;
}

export function getVoucherSavingsLabel(faceValueCents: number, product: Product) {
  const type = getVoucherDiscountType(product);
  const value = getVoucherDiscountValue(product);
  return getVoucherSavingsLabelForConfig(faceValueCents, type, value);
}

export function getProductPriceLabel(product: Product) {
  if (product.kind === "VOUCHER") {
    const amounts = getVoucherAmounts(product);
    const minAmount = amounts.length > 0 ? Math.min(...amounts) : product.price;
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : product.price;

    if (product.voucherMode === "FIXED") {
      if (amounts.length > 1) {
        return `Gutschein ${formatEuro(minAmount)} bis ${formatEuro(maxAmount)}`;
      }
      return amounts.length > 0 ? `Gutschein ab ${formatEuro(minAmount)}` : formatEuro(product.price);
    }

    if (amounts.length > 0) {
      return `Gutschein ${formatEuro(minAmount)} bis ${formatEuro(maxAmount)}`;
    }
  }

  return formatEuro(product.price);
}

export function getVoucherPriceHint(product: Product) {
  if (product.kind !== "VOUCHER") return null;
  const amounts = getVoucherAmounts(product);
  const firstAmount = amounts[0] ?? product.price;
  return getVoucherSavingsLabel(firstAmount, product);
}
