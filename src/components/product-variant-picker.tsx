"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/format";
import type { ProductVariant } from "@/lib/product-variants";

type ProductVariantPickerProps = {
  productId: string;
  variants: ProductVariant[];
  basePriceCents: number;
  loggedIn: boolean;
  initialVariantId?: string | null;
};

export function ProductVariantPicker({
  productId,
  variants,
  basePriceCents,
  loggedIn,
  initialVariantId,
}: ProductVariantPickerProps) {
  const hasVariants = variants.length > 0;
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (hasVariants) {
      if (initialVariantId && variants.some((v) => v.id === initialVariantId)) {
        return initialVariantId;
      }
      return variants[0].id;
    }
    return null;
  });

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedId) ?? null,
    [variants, selectedId],
  );

  const price = selected ? selected.priceCents : basePriceCents;
  const href = hasVariants
    ? `/checkout/${productId}?variant=${encodeURIComponent(selectedId ?? "")}`
    : `/checkout/${productId}`;

  return (
    <div className="mt-6 sm:mt-8">
      {hasVariants && (
        <div className="mb-4">
          <span className="block text-sm font-bold text-ink mb-2">Variante wählen</span>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const active = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  aria-pressed={active}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-white text-ink hover:border-accent"
                  }`}
                >
                  {v.name}
                  <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-mute"}`}>
                    {formatEuro(v.priceCents)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-3xl font-black">{formatEuro(price)}</p>

      {loggedIn ? (
        <Link
          href={href}
          className="mt-6 inline-flex w-full sm:w-auto items-center justify-center bg-accent px-10 py-4 rounded-xl font-bold text-lg text-white hover:bg-accent-hover transition-all"
        >
          Jetzt kaufen
        </Link>
      ) : (
        <a
          href="/handler/sign-in"
          className="mt-6 inline-flex w-full sm:w-auto items-center justify-center bg-accent px-10 py-4 rounded-xl font-bold text-lg text-white hover:bg-accent-hover transition-all"
        >
          Einloggen und kaufen
        </a>
      )}
    </div>
  );
}
