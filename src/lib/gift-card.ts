import crypto from "crypto";

export function generateGiftCardCode(): string {
  const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `FYNDO-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function formatGiftCardCode(code: string): string {
  const cleaned = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length === 8) {
    return `FYNDO-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  }
  return code.toUpperCase();
}
