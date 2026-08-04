import { getRbankConfig, getRbankEmbedCheckoutKey, type RBankConfig } from "./env";

interface CreatePaymentArgs {
  amount: number;
  description: string;
  redirectUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

interface CreatePaymentResult {
  token: string;
  paymentUrl: string;
  expiresAt: string;
}

interface VerifyPaymentResult {
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
  amount: number;
  currency: string;
  paidAt: string | null;
  customerId: string;
  metadata: Record<string, string>;
}

export async function createRbankPayment(
  args: CreatePaymentArgs,
  config?: RBankConfig,
): Promise<CreatePaymentResult> {
  const resolved = config ?? getRbankConfig();
  const credentials = `${resolved.merchantId}:${resolved.merchantSecret}`;

  const res = await fetch(`${resolved.apiUrl}/api/pay/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials}`,
    },
    body: JSON.stringify(args),
  });

  if (res.status === 401) {
    throw new Error(
      "RBank Merchant-Anmeldedaten sind ungültig. Bitte RBANK_MERCHANT_ID und RBANK_MERCHANT_SECRET prüfen.",
    );
  }
  if (res.status === 403) {
    throw new Error(
      "RBank lehnt die Redirect-URL ab. Bitte APP_URL und die erlaubten Redirect-Origins prüfen.",
    );
  }
  if (!res.ok) {
    throw new Error(
      `Zahlungsdienst konnte nicht gestartet werden. (RBank ${res.status})`,
    );
  }

  return res.json();
}

export function buildRbankEmbedCheckoutUrl(token: string, config?: RBankConfig): string {
  const resolved = config ?? getRbankConfig();
  const key = getRbankEmbedCheckoutKey();
  return `${resolved.apiUrl}/embed/pay/${encodeURIComponent(token)}?key=${encodeURIComponent(key)}`;
}

export async function verifyRbankPayment(
  token: string,
  config?: RBankConfig,
): Promise<VerifyPaymentResult> {
  const resolved = config ?? getRbankConfig();
  const credentials = `${resolved.merchantId}:${resolved.merchantSecret}`;

  const res = await fetch(`${resolved.apiUrl}/api/pay/verify/${token}`, {
    headers: {
      Authorization: `Bearer ${credentials}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Zahlungsverifikation fehlgeschlagen. (RBank ${res.status})`);
  }

  return res.json();
}
