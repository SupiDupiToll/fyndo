export function getAdminEmail(): string {
  return process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";
}

export type RBankConfig = {
  apiUrl: string;
  merchantId: string;
  merchantSecret: string;
};

export function getRbankConfig(): RBankConfig {
  return {
    apiUrl: requireEnv("RBANK_API_URL"),
    merchantId: requireEnv("RBANK_MERCHANT_ID"),
    merchantSecret: requireEnv("RBANK_MERCHANT_SECRET"),
  };
}

export function getPosCardSecret(): string {
  return process.env.POS_CARD_SECRET ?? "";
}

export function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function getTippiePayBase(): string {
  return process.env.TIPPIE_PAY_BASE ?? "https://pay.tippie.de/business-pay/3763235/EUR/";
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}
