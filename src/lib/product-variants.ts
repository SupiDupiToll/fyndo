export type ProductVariant = {
  id: string;
  name: string;
  priceCents: number;
};

export function parseVariants(value: unknown): ProductVariant[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const variants: ProductVariant[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    const id = String(o.id ?? "");
    const name = String(o.name ?? "").trim();
    const priceCents = Number(o.priceCents);
    if (!id || !name || !Number.isFinite(priceCents) || priceCents < 0) continue;
    variants.push({ id, name, priceCents });
  }
  return variants.length > 0 ? variants : undefined;
}

export function normalizeVariantsFromForm(value: unknown): ProductVariant[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const variants: ProductVariant[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    const id = String(o.id ?? "").trim() || `v${Math.random().toString(36).slice(2, 8)}`;
    const name = String(o.name ?? "").trim();
    const price = parseFloat(String(o.price ?? ""));
    if (!name || !Number.isFinite(price) || price < 0) continue;
    variants.push({ id, name, priceCents: Math.round(price * 100) });
  }
  return variants.length > 0 ? variants : undefined;
}

export function findVariant(product: { variants: unknown }, variantId: string | null) {
  if (!variantId) return null;
  const variants = parseVariants(product.variants);
  return variants?.find((v) => v.id === variantId) ?? null;
}

export function minVariantPriceCents(variants: unknown): number | null {
  const parsed = parseVariants(variants);
  if (!parsed || parsed.length === 0) return null;
  return Math.min(...parsed.map((v) => v.priceCents));
}
