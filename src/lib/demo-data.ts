import { formatEuro } from "@/lib/format";

export type DemoVendor = {
  id: string;
  sellerName: string | null;
  displayName: string | null;
  email: string;
  role: "SUPER_ADMIN" | "SELLER" | "USER";
  sellerBalanceCents: number;
};

export type DemoVariant = {
  id: string;
  name: string;
  priceCents: number;
};

export type DemoProduct = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  price: number;
  kind: "PRODUCT" | "VOUCHER";
  voucherMode: "RANGE" | "FIXED" | null;
  voucherMinCents: number | null;
  voucherMaxCents: number | null;
  voucherStepCents: number | null;
  voucherAmounts: number[] | null;
  voucherDiscountType: "FIXED" | "PERCENT" | null;
  voucherDiscountValue: number | null;
  voucherNoticeText: string | null;
  variants: DemoVariant[] | null;
  isActive: boolean;
  posOnly: boolean;
  posVisible: boolean;
  isContainer: boolean;
  isTopping: boolean;
  seller: { id: string; sellerName: string | null; displayName: string | null };
};

export type DemoOrder = {
  id: string;
  product: { title: string; imageUrl: string | null };
  variantName: string | null;
  amountCents: number;
  voucherFaceValueCents: number | null;
  giftCardDeduction: number | null;
  status: "PENDING" | "PAID" | "DONE" | "CANCELLED";
  createdAt: string;
  buyerName: string;
};

export type DemoThirdPartyOrder = {
  id: string;
  productUrl: string;
  shopName: string;
  shopHost: string;
  shopFaviconUrl: string | null;
  customerNote: string | null;
  amountCents: number | null;
  adminNote: string | null;
  status: "REQUESTED" | "QUOTED" | "ORDERED" | "DONE" | "CANCELLED";
  createdAt: string;
  user: { displayName: string; email: string };
};

function img(id: string, w = 600) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=60`;
}

export const demoVendors: DemoVendor[] = [
  {
    id: "v-rundishop",
    sellerName: "RundiShop",
    displayName: "Rundi Xie",
    email: "demo@rundishop.sdtoll.de",
    role: "SELLER",
    sellerBalanceCents: 482350,
  },
  {
    id: "v-sweetcream",
    sellerName: "Sweet Cream",
    displayName: "Laura Eismann",
    email: "demo@sweetcream.sdtoll.de",
    role: "SELLER",
    sellerBalanceCents: 128750,
  },
  {
    id: "v-technest",
    sellerName: "TechNest",
    displayName: "Jonas Berg",
    email: "demo@technest.sdtoll.de",
    role: "SELLER",
    sellerBalanceCents: 96500,
  },
  {
    id: "v-greenleaf",
    sellerName: "GreenLeaf",
    displayName: "Mira Sol",
    email: "demo@greenleaf.sdtoll.de",
    role: "SELLER",
    sellerBalanceCents: 42300,
  },
  {
    id: "v-admin",
    sellerName: null,
    displayName: "Fyndo Admin",
    email: "admin@fyndo.app",
    role: "SUPER_ADMIN",
    sellerBalanceCents: 0,
  },
];

const sellerOf = (id: string) => {
  const vendor = demoVendors.find((v) => v.id === id);
  return { id: vendor!.id, sellerName: vendor!.sellerName, displayName: vendor!.displayName };
};

export const demoProducts: DemoProduct[] = [
  {
    id: "p-airpods",
    title: "Aurora Pro Kopfhörer",
    description:
      "Kabellose In-Ear-Kopfhörer mit aktivem Noise-Cancelling, transparentem Modus und 30 Stunden Akkulaufzeit. Inklusive Ladecase mit USB-C.",
    imageUrl: img("photo-1505740420928-5e560c06d30e"),
    price: 8900,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: [
      { id: "v-air-1", name: "Weiß", priceCents: 8900 },
      { id: "v-air-2", name: "Schwarz", priceCents: 8900 },
      { id: "v-air-3", name: "Pro Max", priceCents: 11900 },
    ],
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-technest"),
  },
  {
    id: "p-sneaker",
    title: "Ultrabooster Sneaker",
    description:
      "Leichter Laufschuh mit reaktivem Schaum, atmungsaktivem Mesh und strapazierfähiger Gummisohle. Ideal für Alltag und Sport.",
    imageUrl: img("photo-1542291026-7eec264c27ff"),
    price: 12900,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: [
      { id: "v-sn-38", name: "EU 38", priceCents: 12900 },
      { id: "v-sn-40", name: "EU 40", priceCents: 12900 },
      { id: "v-sn-42", name: "EU 42", priceCents: 12900 },
      { id: "v-sn-44", name: "EU 44", priceCents: 13900 },
    ],
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-rundishop"),
  },
  {
    id: "p-smartwatch",
    title: "Milano Smartwatch",
    description:
      "Sportuhr mit AMOLED-Display, GPS, Schlaf- und Herzfrequenz-Tracking. Wasserdicht bis 5 ATM und mit bis zu 14 Tagen Akkulaufzeit.",
    imageUrl: img("photo-1523275335684-37898b6baf30"),
    price: 24900,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: [
      { id: "v-w-41", name: "41 mm", priceCents: 24900 },
      { id: "v-w-45", name: "45 mm", priceCents: 27900 },
    ],
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-technest"),
  },
  {
    id: "p-backpack",
    title: "Eco Rucksack",
    description:
      "Robuster Rucksack aus recyceltem Material mit gepolstertem Laptopfach, seitlichen Flaschenhaltern und wasserabweisender Beschichtung.",
    imageUrl: img("photo-1553062407-98eeb64c6a62"),
    price: 7900,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: [
      { id: "v-b-20", name: "20 L", priceCents: 7900 },
      { id: "v-b-30", name: "30 L", priceCents: 8900 },
    ],
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-greenleaf"),
  },
  {
    id: "p-sunglasses",
    title: "Mirage Sonnenbrille",
    description:
      "Sonnenbrille mit polarisierten Gläsern und UV-400-Schutz. Leichter Metallrahmen mit verstellbaren Nasenpads.",
    imageUrl: img("photo-1572635196237-14b3f281503f"),
    price: 14900,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-rundishop"),
  },
  {
    id: "p-notebook",
    title: "Premium Notizbuch",
    description:
      "Säurefreies Notizbuch aus recyceltem Papier mit festem Einband, Leseband und 192 Seiten. Erhältlich in mehreren Farben.",
    imageUrl: img("photo-1544716278-ca5e3f4abd8c"),
    price: 1999,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: [
      { id: "v-n-green", name: "Grün", priceCents: 1999 },
      { id: "v-n-blue", name: "Blau", priceCents: 1999 },
      { id: "v-n-graphite", name: "Graphit", priceCents: 1999 },
    ],
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-greenleaf"),
  },
  {
    id: "p-kamera",
    title: "Vintage Kamera",
    description:
      "Kompakte Systemkamera mit 24 MP Sensor, 4K-Video und klappbarem Touchscreen. Inklusive Objektivschutzkappe und Tragegurt.",
    imageUrl: img("photo-1516035069371-29a1b244cc32"),
    price: 54900,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-technest"),
  },
  {
    id: "p-monstera",
    title: "Monstera Deliciosa",
    description:
      "Große Zimmerpflanze im Keramiktopf. Robust, pflegeleicht und ideal für helles bis halbschattiges Licht.",
    imageUrl: img("photo-1485955900006-10f4d324d411"),
    price: 3499,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-greenleaf"),
  },
  {
    id: "p-fyndo-gutschein",
    title: "Fyndo Geschenkgutschein",
    description:
      "Der flexible Geschenkgutschein für den ganzen Marktplatz. Beim Kauf sparen: Je Betrag gibt es automatisch 5% Rabatt.",
    imageUrl: img("photo-1549465220-1a8b9238cd48"),
    price: 1000,
    kind: "VOUCHER",
    voucherMode: "FIXED",
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: [1000, 2500, 5000, 10000],
    voucherDiscountType: "PERCENT",
    voucherDiscountValue: 5,
    voucherNoticeText:
      "Der Gutschein ist 12 Monate gültig.\nEine Barauszahlung des Restbetrags ist nicht möglich.",
    variants: null,
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-rundishop"),
  },
  {
    id: "p-sweetcream-gutschein",
    title: "Sweet Cream Gutschein",
    description:
      "Gutschein für das Eiscafé Sweet Cream. Ideal zum Verschenken – einlösbar direkt an der Kasse.",
    imageUrl: img("photo-1560008581-09826d1de69e"),
    price: 2000,
    kind: "VOUCHER",
    voucherMode: "RANGE",
    voucherMinCents: 2000,
    voucherMaxCents: 20000,
    voucherStepCents: 1000,
    voucherAmounts: null,
    voucherDiscountType: "FIXED",
    voucherDiscountValue: 300,
    voucherNoticeText:
      "Gültig in allen Sweet Cream Filialen.\nKeine Barauszahlung des Restbetrags.",
    variants: null,
    isActive: true,
    posOnly: false,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-sweetcream"),
  },
];

export const demoPosProducts: DemoProduct[] = [
  {
    id: "pos-becher",
    title: "Becher",
    description: "Klassischer Becher für deine Kugeln.",
    imageUrl: img("photo-1501443762994-82bd5dace89a", 400),
    price: 50,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: true,
    isTopping: false,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-schuessel",
    title: "Schüssel",
    description: "Große Schüssel für extra Kugeln.",
    imageUrl: img("photo-1571115177098-24ec42ed204d", 400),
    price: 100,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: true,
    isTopping: false,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-vanille",
    title: "Vanille Kugel",
    description: "Cremige Bourbon-Vanille.",
    imageUrl: img("photo-1497034825429-c343d7c6a68f", 400),
    price: 150,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-schoko",
    title: "Schokolade Kugel",
    description: "Belgische Schokolade, extra kräftig.",
    imageUrl: img("photo-1563805042-7684c019e1cb", 400),
    price: 150,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-erdbeer",
    title: "Erdbeere Kugel",
    description: "Fruchtig mit echten Erdbeerstücken.",
    imageUrl: img("photo-1498747942102-5635fef5b90b", 400),
    price: 150,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-mango",
    title: "Mango-Sorbet Kugel",
    description: "Veganes Mango-Sorbet.",
    imageUrl: img("photo-1502741224143-90386d7f8c82", 400),
    price: 160,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: [
      { id: "pos-v-m-1", name: "Kugel", priceCents: 160 },
      { id: "pos-v-m-2", name: "Doppel", priceCents: 290 },
    ],
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: false,
    isTopping: false,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-sahne",
    title: "Sahne",
    description: "Frisch geschlagene Sahne.",
    imageUrl: img("photo-1488477181946-6428a0291777", 400),
    price: 60,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: false,
    isTopping: true,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-streusel",
    title: "Streusel",
    description: "Bunte Zuckerstreusel.",
    imageUrl: img("photo-1558326567-98ae2405596b", 400),
    price: 40,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: false,
    isTopping: true,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-soesse",
    title: "Schokosauce",
    description: "Warme Schokosauce.",
    imageUrl: img("photo-1541783245831-57d6fb0926d3", 400),
    price: 50,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: false,
    isTopping: true,
    seller: sellerOf("v-sweetcream"),
  },
  {
    id: "pos-nuesse",
    title: "Nüsse",
    description: "Geröstete Haselnüsse.",
    imageUrl: img("photo-1508061253366-f7da158b6d46", 400),
    price: 70,
    kind: "PRODUCT",
    voucherMode: null,
    voucherMinCents: null,
    voucherMaxCents: null,
    voucherStepCents: null,
    voucherAmounts: null,
    voucherDiscountType: null,
    voucherDiscountValue: null,
    voucherNoticeText: null,
    variants: null,
    isActive: true,
    posOnly: true,
    posVisible: true,
    isContainer: false,
    isTopping: true,
    seller: sellerOf("v-sweetcream"),
  },
];

export function getDemoProducts() {
  return demoProducts;
}

export function getDemoProduct(id: string) {
  return demoProducts.find((p) => p.id === id) ?? null;
}

export function getDemoMarketplaceProducts(query?: string) {
  const q = (query ?? "").trim().toLowerCase();
  const base = demoProducts.filter((p) => !p.posOnly);
  if (!q) return base;
  return base.filter((p) => p.title.toLowerCase().includes(q));
}

export function getDemoVendorProducts(vendorName: string) {
  const normalized = vendorName.trim().toLowerCase();
  return demoProducts.filter((p) => {
    const name = p.seller.sellerName ?? p.seller.displayName ?? "";
    return !p.posOnly && name.trim().toLowerCase() === normalized;
  });
}

export function getDemoPosProducts() {
  const products = demoPosProducts;
  const toppings = products.filter((p) => p.isTopping);
  const grid = products.filter((p) => !p.isTopping);
  return { products: grid, toppings };
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const demoOrders: DemoOrder[] = [
  {
    id: "o-1",
    product: { title: "Ultrabooster Sneaker", imageUrl: img("photo-1542291026-7eec264c27ff", 200) },
    variantName: "EU 42",
    amountCents: 12900,
    voucherFaceValueCents: null,
    giftCardDeduction: null,
    status: "DONE",
    createdAt: daysAgo(1),
    buyerName: "Lena M.",
  },
  {
    id: "o-2",
    product: { title: "Aurora Pro Kopfhörer", imageUrl: img("photo-1505740420928-5e560c06d30e", 200) },
    variantName: "Schwarz",
    amountCents: 8900,
    voucherFaceValueCents: null,
    giftCardDeduction: 2500,
    status: "PAID",
    createdAt: daysAgo(3),
    buyerName: "Tom K.",
  },
  {
    id: "o-3",
    product: { title: "Fyndo Geschenkgutschein", imageUrl: img("photo-1549465220-1a8b9238cd48", 200) },
    variantName: null,
    amountCents: 9500,
    voucherFaceValueCents: 10000,
    giftCardDeduction: null,
    status: "DONE",
    createdAt: daysAgo(5),
    buyerName: "Sara B.",
  },
  {
    id: "o-4",
    product: { title: "Monstera Deliciosa", imageUrl: img("photo-1485955900006-10f4d324d411", 200) },
    variantName: null,
    amountCents: 3499,
    voucherFaceValueCents: null,
    giftCardDeduction: null,
    status: "PENDING",
    createdAt: daysAgo(6),
    buyerName: "Noah P.",
  },
  {
    id: "o-5",
    product: { title: "Premium Notizbuch", imageUrl: img("photo-1544716278-ca5e3f4abd8c", 200) },
    variantName: "Graphit",
    amountCents: 1999,
    voucherFaceValueCents: null,
    giftCardDeduction: null,
    status: "DONE",
    createdAt: daysAgo(8),
    buyerName: "Emma W.",
  },
];

export const demoThirdPartyOrders: DemoThirdPartyOrder[] = [
  {
    id: "tpo-1",
    productUrl: "https://www.amazon.de/dp/B08F7B4K9M",
    shopName: "Amazon",
    shopHost: "www.amazon.de",
    shopFaviconUrl: "https://www.amazon.de/favicon.ico",
    customerNote: "Menge: 1 | Optionen: Farbe: Schwarz",
    amountCents: 42900,
    adminNote: "Bestellt am 12.08.",
    status: "ORDERED",
    createdAt: daysAgo(2),
    user: { displayName: "Lena M.", email: "lena@example.de" },
  },
  {
    id: "tpo-2",
    productUrl: "https://www.mediamarkt.de/de/product/_philips-x2-2564789.html",
    shopName: "MediaMarkt",
    shopHost: "www.mediamarkt.de",
    shopFaviconUrl: "https://www.mediamarkt.de/favicon.ico",
    customerNote: "Menge: 1 | Geschätzter Preis: 59,99€",
    amountCents: null,
    adminNote: null,
    status: "REQUESTED",
    createdAt: daysAgo(1),
    user: { displayName: "Tom K.", email: "tom@example.de" },
  },
  {
    id: "tpo-3",
    productUrl: "https://www.otto.de/p/technik/laptop/",
    shopName: "OTTO",
    shopHost: "www.otto.de",
    shopFaviconUrl: "https://www.otto.de/favicon.ico",
    customerNote: "Menge: 2 | Optionen: Modell: 2024",
    amountCents: 118900,
    adminNote: "Rückmeldung vom Kunden erhalten.",
    status: "QUOTED",
    createdAt: daysAgo(4),
    user: { displayName: "Sara B.", email: "sara@example.de" },
  },
  {
    id: "tpo-4",
    productUrl: "https://www.zalando.de/sneaker-rot/",
    shopName: "Zalando",
    shopHost: "www.zalando.de",
    shopFaviconUrl: "https://www.zalando.de/favicon.ico",
    customerNote: "Menge: 1 | Geschätzter Preis: 89,00€",
    amountCents: 8900,
    adminNote: null,
    status: "DONE",
    createdAt: daysAgo(10),
    user: { displayName: "Noah P.", email: "noah@example.de" },
  },
];

export function demoPriceLabel(product: DemoProduct) {
  if (product.kind === "VOUCHER") {
    const amounts = Array.isArray(product.voucherAmounts)
      ? product.voucherAmounts
      : product.voucherMinCents != null && product.voucherMaxCents != null
        ? [product.voucherMinCents, product.voucherMaxCents]
        : [];
    if (amounts.length > 0) {
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      return min === max
        ? `Gutschein ${formatEuro(min)}`
        : `Gutschein ${formatEuro(min)} bis ${formatEuro(max)}`;
    }
    return formatEuro(product.price);
  }
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const min = Math.min(...product.variants.map((v) => v.priceCents));
    return `ab ${formatEuro(min)}`;
  }
  return formatEuro(product.price);
}

export type DemoAdminStats = {
  productCount: number;
  orderCount: number;
  paidOrderCount: number;
  grossRevenue: number;
  cashRevenue: number;
  giftCardRevenue: number;
  tpoCount: number;
  sellerBalanceCents: number;
  recentPaidOrders: DemoOrder[];
};

export function getDemoAdminStats(): DemoAdminStats {
  const paid = demoOrders.filter((o) => o.status === "PAID" || o.status === "DONE");
  const cashRevenue = paid.reduce((s, o) => s + o.amountCents, 0);
  const giftCardRevenue = paid.reduce((s, o) => s + (o.giftCardDeduction ?? 0), 0);
  return {
    productCount: demoProducts.length + demoPosProducts.length,
    orderCount: demoOrders.length,
    paidOrderCount: paid.length,
    grossRevenue: cashRevenue + giftCardRevenue,
    cashRevenue,
    giftCardRevenue,
    tpoCount: demoThirdPartyOrders.length,
    sellerBalanceCents: 482350,
    recentPaidOrders: paid,
  };
}
