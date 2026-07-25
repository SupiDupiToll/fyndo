import { formatEuro } from "@/lib/format";

type NotifyOrderPaidArgs = {
  buyerEmail: string;
  productName: string;
  amountCents: number;
  voucherFaceValueCents?: number | null;
  sellerName?: string | null;
};

type NotifyThirdPartyOrderArgs = {
  buyerEmail: string;
  productUrl: string;
  shopName: string;
  shopHost: string;
  customerNote?: string | null;
};

type NotifyThirdPartyOrderPaidArgs = {
  buyerEmail: string;
  productUrl: string;
  shopName: string;
  shopHost: string;
  amountCents: number;
};

function maskEmail(email: string) {
  if (email.length <= 5) return email;
  return `${email.slice(0, 5)}...`;
}

export function buildOrderNotificationMessage(args: NotifyOrderPaidArgs) {
  const parts = [`${maskEmail(args.buyerEmail)} hat bestellt: ${args.productName}`];

  if (typeof args.voucherFaceValueCents === "number") {
    const savings = Math.max(args.voucherFaceValueCents - args.amountCents, 0);
    parts.push(
      `Gutscheinwert: ${formatEuro(args.voucherFaceValueCents)} | gespart: ${formatEuro(savings)} | bezahlt: ${formatEuro(args.amountCents)}`,
    );
  } else {
    parts.push(`Betrag: ${formatEuro(args.amountCents)}`);
  }

  if (args.sellerName) {
    parts.push(`Verkäufer: ${args.sellerName}`);
  }

  return parts.join("\n");
}

export async function sendOrderNotification(args: NotifyOrderPaidArgs) {
  const webhookUrl = process.env.NTFY_WEBHOOK_URL;
  if (!webhookUrl) return;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      Title: "Neue bezahlte Bestellung",
      Priority: "default",
      Tags: "shopping_bags",
    },
    body: buildOrderNotificationMessage(args),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NTFY_FAILED_${response.status}`);
  }
}

export function buildThirdPartyOrderNotificationMessage(args: NotifyThirdPartyOrderArgs) {
  const parts = [
    `${maskEmail(args.buyerEmail)} hat eine Drittshop-Bestellung angefragt`,
    `Shop: ${args.shopName} (${args.shopHost})`,
    `Link: ${args.productUrl}`,
  ];

  if (args.customerNote) {
    parts.push(`Hinweis: ${args.customerNote}`);
  }

  return parts.join("\n");
}

export async function sendThirdPartyOrderNotification(args: NotifyThirdPartyOrderArgs) {
  const webhookUrl = process.env.NTFY_WEBHOOK_URL;
  if (!webhookUrl) return;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      Title: "Neue Drittshop-Bestellung",
      Priority: "default",
      Tags: "shopping_bags",
    },
    body: buildThirdPartyOrderNotificationMessage(args),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NTFY_FAILED_${response.status}`);
  }
}

export function buildThirdPartyOrderPaidNotificationMessage(args: NotifyThirdPartyOrderPaidArgs) {
  return [
    `${maskEmail(args.buyerEmail)} hat die Drittshop-Bestellung bezahlt`,
    `Shop: ${args.shopName} (${args.shopHost})`,
    `Link: ${args.productUrl}`,
    `Betrag: ${formatEuro(args.amountCents)}`,
  ].join("\n");
}

export async function sendThirdPartyOrderPaidNotification(args: NotifyThirdPartyOrderPaidArgs) {
  const webhookUrl = process.env.NTFY_WEBHOOK_URL;
  if (!webhookUrl) return;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      Title: "Drittshop bezahlt",
      Priority: "default",
      Tags: "money_with_wings",
    },
    body: buildThirdPartyOrderPaidNotificationMessage(args),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NTFY_FAILED_${response.status}`);
  }
}
