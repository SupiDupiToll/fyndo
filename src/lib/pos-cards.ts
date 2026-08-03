import { createHmac, timingSafeEqual } from "node:crypto";

export const POS_CARD_TOKEN_PREFIX = "FYNDO";
const TOKEN_SEPARATOR = ":";
const SIG_BYTES = 20;

function hmacSig(secret: string, sellerId: string, number: number): Buffer {
  return createHmac("sha256", secret)
    .update(`${sellerId}${TOKEN_SEPARATOR}${number}`)
    .digest()
    .subarray(0, SIG_BYTES);
}

export function encodeCardToken(secret: string, sellerId: string, number: number): string {
  const sig = hmacSig(secret, sellerId, number).toString("base64url");
  return `${POS_CARD_TOKEN_PREFIX}.${Buffer.from(`${number}${TOKEN_SEPARATOR}${sig}`).toString("base64url")}`;
}

export function decodeCardToken(secret: string, sellerId: string, token: string): number | null {
  if (!token.startsWith(`${POS_CARD_TOKEN_PREFIX}.`)) return null;
  const payload = token.slice(POS_CARD_TOKEN_PREFIX.length + 1);
  if (!payload) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sepIndex = decoded.indexOf(TOKEN_SEPARATOR);
  if (sepIndex <= 0) return null;
  const rawNumber = decoded.slice(0, sepIndex);
  const sig = decoded.slice(sepIndex + 1);
  if (!/^\d+$/.test(rawNumber)) return null;
  const number = Number(rawNumber);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  const expected = hmacSig(secret, sellerId, number);
  const provided = Buffer.from(sig, "base64url");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;
  return number;
}
