import { getTippiePayBase } from "@/lib/env";

export const POS_PAYMENT_METHODS = ["RBANK", "TIPPIE", "TERMINAL", "CASH"] as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export const POS_MIN_DIGITAL_PAYMENT_CENTS = 50;

export function buildTippieUrl(amountCents: number, reference?: string) {
  const base = `${getTippiePayBase()}${Math.max(amountCents, 0)}`;
  return reference ? `${base}?reference=${encodeURIComponent(reference)}` : base;
}

export function buildRbankUrl(amountCents: number) {
  return buildTippieUrl(amountCents);
}
