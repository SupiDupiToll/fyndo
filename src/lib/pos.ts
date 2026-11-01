import { getTippiePayBase } from "@/lib/env";

export const POS_PAYMENT_METHODS = ["RBANK", "TIPPIE", "TERMINAL", "CASH", "GUTSCHEIN"] as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export const POS_MIN_DIGITAL_PAYMENT_CENTS = 50;

export const POS_RBANK_CHECKOUT_MODES = ["embed", "qr"] as const;
export type PosRbankCheckoutMode = (typeof POS_RBANK_CHECKOUT_MODES)[number];
export const POS_RBANK_CHECKOUT_MODE_KEY = "fyndo:pos:rbank-checkout-mode";

export function parseRbankCheckoutMode(
  value: string | null | undefined,
): PosRbankCheckoutMode {
  return value === "qr" ? "qr" : "embed";
}

export function buildTippieUrl(amountCents: number, reference?: string) {
  const base = `${getTippiePayBase()}${Math.max(amountCents, 0)}`;
  return reference ? `${base}?reference=${encodeURIComponent(reference)}` : base;
}

export function buildRbankUrl(amountCents: number) {
  return buildTippieUrl(amountCents);
}
