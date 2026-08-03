export const POS_ANNOUNCEMENT_KEYS = [
  "welcome",
  "product-added",
  "product-removed",
  "container",
  "cart",
  "checkout",
  "select-payment",
  "card-scanned",
  "rbank-qr",
  "tippie-qr",
  "terminal-call",
  "cash",
  "processing",
  "payment-confirmed",
  "payment-error",
  "new-order",
  "order-sent",
  "idle-countdown",
] as const;

export type AnnouncementKey = (typeof POS_ANNOUNCEMENT_KEYS)[number];
