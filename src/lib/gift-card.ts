export function generateGiftCardCode(): string {
  // Web Crypto statt `node:crypto`, damit die Funktion auch auf Cloudflare
  // Workers (ohne Node-Builtins) läuft.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `FYNDO-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function formatGiftCardCode(code: string): string {
  const cleaned = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length === 8) {
    return `FYNDO-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  }
  return code.toUpperCase();
}
