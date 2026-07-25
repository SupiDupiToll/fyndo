"use client";

import { useUser, useHexclaveApp } from "@hexclave/next";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PurchaseButton } from "@/components/purchase-button";
import Link from "next/link";

interface Product {
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
}

export default function CheckoutPage() {
  const user = useUser({ or: "redirect" });
  const app = useHexclaveApp();
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const productId = params?.productId;

  useEffect(() => {
    if (!productId || productId === "null") {
      setPageLoading(false);
      return;
    }
    fetch(`/api/products/${productId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Produkt nicht gefunden");
        return res.json();
      })
      .then((data) => setProduct(data))
      .catch(() => setError("Produkt nicht gefunden"))
      .finally(() => setPageLoading(false));
  }, [productId]);

  if (!user) {
    app.redirectToSignIn();
    return null;
  }

  if (!productId || productId === "null") {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-16 flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold">Fehler</h1>
        <p className="mt-2 text-mute">Ungültige Produkt-ID.</p>
        <Link href="/" className="mt-6 rounded-full bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Zurück zum Shop
        </Link>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-16 flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold">Fehler</h1>
        <p className="mt-2 text-mute">{error}</p>
        <Link href="/" className="mt-6 rounded-full bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all">
          Zurück zum Shop
        </Link>
      </div>
    );
  }

  const voucherAmounts = product.kind === "VOUCHER" && Array.isArray(product.voucherAmounts)
    ? product.voucherAmounts
    : [];

  return (
    <div className="max-w-[600px] mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Bestellübersicht</h1>

      <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-white">
        <div className="aspect-[2/1] bg-tile">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain p-4" />
          ) : (
            <div className="flex h-full items-center justify-center text-mute">Kein Bild</div>
          )}
        </div>

        <div className="p-6">
          <h2 className="text-xl font-bold">{product.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-mute line-clamp-3">
            {product.description}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <PurchaseButton
          productId={product.id}
          label={product.kind === "VOUCHER" ? "Jetzt Gutschein kaufen" : "Jetzt kaufen"}
          amountOptions={voucherAmounts}
          isVoucher={product.kind === "VOUCHER"}
          voucherDiscountType={product.voucherDiscountType}
          voucherDiscountValue={product.voucherDiscountValue ?? 0}
          voucherNoticeText={product.voucherNoticeText}
          fixedAmountCents={product.kind === "PRODUCT" ? product.price : undefined}
        />
      </div>
    </div>
  );
}
