"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  announce,
  clearAnnouncements,
  formatSpokenEuro,
  setSpeechEnabled,
} from "@/lib/pos-speech";
import { POS_MIN_DIGITAL_PAYMENT_CENTS, POS_PAYMENT_METHODS, type PosPaymentMethod } from "@/lib/pos";
import { formatEuro } from "@/lib/format";

export type PosVariant = { id: string; name: string; priceCents: number };

export type PosProduct = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  price: number;
  variants: PosVariant[];
};

type CartItem = { product: PosProduct; variant: PosVariant | null; qty: number };

type OrderInfo = {
  posGroupId: string;
  posConfirmToken: string;
  posOrderNumber: number;
  totalCents: number;
  itemCount: number;
};

const METHOD_LABELS: Record<PosPaymentMethod, { title: string; sub: string; icon: string }> = {
  RBANK: { title: "RBank", sub: "QR-Code scannen & im Handy zahlen", icon: "fa-solid fa-mobile-screen" },
  TIPPIE: { title: "PayPal / Apple Pay / Karte", sub: "QR-Code scannen & online zahlen", icon: "fa-solid fa-credit-card" },
  TERMINAL: { title: "Kartenterminal", sub: "Karte an das Terminal halten", icon: "fa-solid fa-id-card" },
  CASH: { title: "Bar", sub: "Betrag an der Kasse bezahlen", icon: "fa-solid fa-money-bill-wave" },
};

function itemPrice(product: PosProduct, variant: PosVariant | null) {
  return variant ? variant.priceCents : product.price;
}

function itemLabel(item: CartItem) {
  return item.variant ? `${item.product.title} (${item.variant.name})` : item.product.title;
}

export function PosKiosk({ vendorName, products }: { vendorName: string; products: PosProduct[] }) {
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pickerProduct, setPickerProduct] = useState<PosProduct | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [method, setMethod] = useState<PosPaymentMethod | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ totalCents: number; orderNumber: number } | null>(null);
  const [rbankStatus, setRbankStatus] = useState<string | null>(null);
  const initialAnnounceRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("fyndo-pos-speaker");
    if (stored !== null) {
      const on = stored === "1";
      setSpeakerOn(on);
      setSpeechEnabled(on);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("fyndo-pos-speaker", speakerOn ? "1" : "0");
    setSpeechEnabled(speakerOn);
  }, [speakerOn]);

  useEffect(() => {
    if (initialAnnounceRef.current) return;
    initialAnnounceRef.current = true;
    const t = window.setTimeout(() => {
      announce("welcome", `Willkommen bei ${vendorName}. Wählen Sie Ihre Produkte.`);
    }, 600);
    return () => window.clearTimeout(t);
  }, [vendorName]);

  const cartCount = useMemo(() => Array.from(cart.values()).reduce((s, i) => s + i.qty, 0), [cart]);
  const cartTotal = useMemo(
    () => Array.from(cart.values()).reduce((s, i) => s + itemPrice(i.product, i.variant) * i.qty, 0),
    [cart],
  );

  function cartKey(product: PosProduct, variant: PosVariant | null) {
    return `${product.id}:${variant?.id ?? ""}`;
  }

  function setQty(product: PosProduct, variant: PosVariant | null, qty: number) {
    const key = cartKey(product, variant);
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(key);
      else next.set(key, { product, variant, qty });
      return next;
    });
  }

  function addProduct(product: PosProduct, variant: PosVariant | null) {
    const key = cartKey(product, variant);
    const current = cart.get(key)?.qty ?? 0;
    setQty(product, variant, current + 1);
    const label = variant ? `${product.title} ${variant.name}` : product.title;
    announce("product-added", `${label}, ${formatSpokenEuro(itemPrice(product, variant))}.`);
  }

  function removeProduct(product: PosProduct, variant: PosVariant | null) {
    setQty(product, variant, 0);
    const label = variant ? `${product.title} ${variant.name}` : product.title;
    announce("product-removed", `${label} entfernt.`);
  }

  function openPicker(product: PosProduct) {
    setPickerProduct(product);
    announce("select-payment", `${product.title}. Bitte Größe oder Variante wählen.`);
  }

  function clearCart() {
    setCart(new Map());
  }

  async function startCheckout() {
    if (cart.size === 0) return;
    setError("");
    setCartOpen(false);
    setCheckoutOpen(true);
    announce("checkout", "Zur Kasse.");
    announce("select-payment", `Bitte wählen Sie Ihre Zahlungsart.`);
  }

  async function selectMethod(m: PosPaymentMethod) {
    if (cart.size === 0) return;
    setError("");
    setBusy(true);
    setMethod(m);
    setPaymentUrl(null);
    setRbankStatus(null);
    try {
      let orderInfo = order;
      if (!orderInfo) {
        const orderRes = await fetch("/api/pos/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendor: vendorName,
            items: Array.from(cart.values()).map((i) => ({
              productId: i.product.id,
              qty: i.qty,
              variantId: i.variant?.id ?? null,
            })),
          }),
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) {
          setError(orderData.error ?? "Bestellung konnte nicht gestartet werden.");
          setMethod(null);
          setBusy(false);
          return;
        }
        orderInfo = orderData;
        setOrder(orderData);
      }

      const currentOrder = orderInfo!;
      const res = await fetch("/api/pos/orders/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: currentOrder.posGroupId,
          posConfirmToken: currentOrder.posConfirmToken,
          method: m,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Zahlungsstart fehlgeschlagen.");
        setMethod(null);
        setBusy(false);
        return;
      }
      setPaymentUrl(data.paymentUrl ?? null);
      announceByMethod(m, currentOrder.totalCents, currentOrder.posOrderNumber);
    } catch {
      setError("Zahlungsstart fehlgeschlagen.");
      setMethod(null);
    } finally {
      setBusy(false);
    }
  }

  function announceByMethod(m: PosPaymentMethod, totalCents: number, orderNumber: number) {
    const total = formatSpokenEuro(totalCents);
    if (m === "RBANK") announce("rbank-qr", `Bitte scannen Sie den QR-Code mit Ihrem Handy und zahlen Sie ${total}.`);
    else if (m === "TIPPIE") announce("tippie-qr", `Bitte scannen Sie den QR-Code und zahlen Sie ${total} mit PayPal, Apple Pay oder Karte.`);
    else if (m === "TERMINAL") announce("terminal-call", `Kartenzahlung. Das Terminal wird aufgerufen. Bitte halten Sie Ihre Karte an das Terminal.`);
    else if (m === "CASH") announce("cash", `Bitte zahlen Sie ${total} in bar an der Kasse. Ihre Nummer ist ${orderNumber}.`);
  }

  function onConfirmed(totalCents: number, orderNumber: number) {
    setDone({ totalCents, orderNumber });
    announce("payment-confirmed", `Vielen Dank! Ihre Bestellung ist raus. Ihre Nummer ist ${orderNumber}.`);
  }

  useEffect(() => {
    if (!checkoutOpen || !order || done !== null) return;
    const current = order;
    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/pos/orders/status?posGroupId=${encodeURIComponent(current.posGroupId)}&posConfirmToken=${encodeURIComponent(current.posConfirmToken)}`,
        );
        const data = await res.json();
        if (data.rbank) setRbankStatus(data.rbank);
        if (data.status === "PAID") {
          cancelled = true;
          onConfirmed(data.totalCents, data.posOrderNumber ?? current.posOrderNumber);
        }
      } catch {
        // ignore, retry on next tick
      }
    }
    void poll();
    const interval = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen, order, done, method]);

  async function abortCheckout() {
    if (order) {
      await fetch("/api/pos/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: order.posGroupId,
          posConfirmToken: order.posConfirmToken,
        }),
      }).catch(() => {});
    }
    closeCheckout();
  }

  function closeCheckout() {
    clearAnnouncements();
    setCheckoutOpen(false);
    setOrder(null);
    setMethod(null);
    setPaymentUrl(null);
    setError("");
    setDone(null);
    setRbankStatus(null);
  }

  function resetForNext() {
    announce("new-order", "Neue Bestellung. Wählen Sie Ihre Produkte.");
    clearCart();
    closeCheckout();
  }

  return (
    <div className="min-h-screen bg-white text-ink flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-line">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
              {vendorName}
              <span className="text-accent">.</span>
            </h1>
            <p className="text-xs text-mute -mt-0.5">Tippen & Bestellen</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSpeakerOn((s) => !s)}
              className={`w-11 h-11 rounded-full border flex items-center justify-center text-lg transition-colors ${speakerOn ? "border-accent text-accent" : "border-line text-mute"}`}
              aria-label={speakerOn ? "Ton aus" : "Ton an"}
            >
              <i className={`${speakerOn ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}`} />
            </button>
            <button
              onClick={() => { setCartOpen(true); announce("cart", "Ihr Warenkorb."); }}
              className="relative flex items-center gap-3 rounded-full border border-line bg-white pl-3 pr-4 py-2 hover:border-accent hover:bg-surf transition-colors"
            >
              <i className="fa-solid fa-basket-shopping text-accent text-lg" />
              <div className="text-right">
                <div className="text-sm sm:text-base font-black text-accent tabular-nums leading-none">{formatEuro(cartTotal)}</div>
                <div className="text-[11px] text-mute leading-tight mt-0.5">{cartCount} Artikel</div>
              </div>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-5 h-5 rounded-full bg-accent text-white text-[11px] font-bold px-1">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-10 max-w-[1440px] w-full mx-auto">
        {products.length === 0 ? (
          <div className="text-center py-24 text-mute">Keine Produkte verfügbar.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {products.map((product) => (
              <ProductTile
                key={product.id}
                product={product}
                qty={product.variants.length > 0 ? 0 : (cart.get(cartKey(product, null))?.qty ?? 0)}
                onAdd={() => {
                  if (product.variants.length > 0) openPicker(product);
                  else addProduct(product, null);
                }}
                onSetQty={(q) => setQty(product, null, q)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-30 bg-white border-t border-line px-4 sm:px-6 py-4">
        <div className="max-w-[1440px] mx-auto">
          <button
            onClick={() => void startCheckout()}
            disabled={cartCount === 0 || busy}
            className={`w-full max-w-2xl mx-auto flex items-center justify-between gap-4 rounded-full px-6 sm:px-8 py-4 sm:py-5 text-lg sm:text-xl font-bold transition-all ${
              cartCount > 0
                ? "bg-accent text-white hover:bg-accent-hover active:scale-[0.99] shadow-lg"
                : "bg-tile text-mute"
            }`}
          >
            <span>{cartCount === 0 ? "Warenkorb ist leer" : "Jetzt bezahlen"}</span>
            <span className="tabular-nums">{formatEuro(cartTotal)}</span>
          </button>
        </div>
      </footer>

      {cartOpen && (
        <CartDrawer
          items={Array.from(cart.values())}
          totalCents={cartTotal}
          onClose={() => setCartOpen(false)}
          onCheckout={() => void startCheckout()}
          onSetQty={(item, q) => setQty(item.product, item.variant, q)}
          onRemove={(item) => removeProduct(item.product, item.variant)}
        />
      )}

      {pickerProduct && (
        <VariantPickerOverlay
          product={pickerProduct}
          onPick={(variant) => {
            addProduct(pickerProduct, variant);
            setPickerProduct(null);
          }}
          onClose={() => setPickerProduct(null)}
        />
      )}

      {checkoutOpen && done === null && (
        <CheckoutOverlay
          vendorName={vendorName}
          order={order}
          totalCents={cartTotal}
          method={method}
          paymentUrl={paymentUrl}
          busy={busy}
          error={error}
          rbankStatus={rbankStatus}
          onSelectMethod={(m) => void selectMethod(m)}
          onBack={method ? () => { clearAnnouncements(); setMethod(null); setPaymentUrl(null); setRbankStatus(null); } : () => void abortCheckout()}
        />
      )}

      {checkoutOpen && done !== null && (
        <SuccessOverlay totalCents={done.totalCents} orderNumber={done.orderNumber} onNewOrder={resetForNext} />
      )}
    </div>
  );
}

function ProductTile({
  product,
  qty,
  onAdd,
  onSetQty,
}: {
  product: PosProduct;
  qty: number;
  onAdd: () => void;
  onSetQty: (qty: number) => void;
}) {
  const hasVariants = product.variants.length > 0;
  const minPrice = hasVariants ? Math.min(...product.variants.map((v) => v.priceCents)) : null;

  return (
    <button
      onClick={onAdd}
      className="group flex flex-col items-stretch rounded-2xl border border-line bg-white p-3 sm:p-4 text-left transition-all hover:border-accent/50 hover:shadow-lg active:scale-[0.97]"
    >
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-surf mb-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-mute text-xl"><i className="fa-solid fa-cube" /></div>
        )}
      </div>
      <div className="mt-auto">
        <h3 className="font-bold text-sm sm:text-base leading-tight line-clamp-2">{product.title}</h3>
        <p className="mt-1 text-lg sm:text-xl font-black text-ink tabular-nums">
          {minPrice != null ? `ab ${formatEuro(minPrice)}` : formatEuro(product.price)}
        </p>
        {hasVariants && (
          <span className="mt-1 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">
            {product.variants.length} Varianten
          </span>
        )}
      </div>
      {qty > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center justify-between rounded-xl bg-accent/10 px-2 py-1.5"
        >
          <button
            onClick={() => onSetQty(qty - 1)}
            className="w-9 h-9 rounded-lg bg-white text-accent font-black flex items-center justify-center shadow-sm hover:bg-accent hover:text-white transition-colors"
            aria-label="Menge verringern"
          >
            −
          </button>
          <span className="text-sm font-black text-accent tabular-nums">{qty}</span>
          <button
            onClick={() => onSetQty(qty + 1)}
            className="w-9 h-9 rounded-lg bg-white text-accent font-black flex items-center justify-center shadow-sm hover:bg-accent hover:text-white transition-colors"
            aria-label="Menge erhöhen"
          >
            +
          </button>
        </div>
      )}
    </button>
  );
}

function VariantPickerOverlay({
  product,
  onPick,
  onClose,
}: {
  product: PosProduct;
  onPick: (variant: PosVariant) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-lg max-h-full overflow-y-auto rounded-3xl border border-line bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{product.title}</h2>
            <p className="text-xs text-mute">Wähle eine Variante</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors" aria-label="Schließen">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {product.variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => onPick(variant)}
              className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 text-left transition-all hover:border-accent/50 hover:bg-surf active:scale-[0.98]"
            >
              <span className="font-bold">{variant.name}</span>
              <span className="text-xl font-black tabular-nums">{formatEuro(variant.priceCents)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CartDrawer({
  items,
  totalCents,
  onClose,
  onCheckout,
  onSetQty,
  onRemove,
}: {
  items: CartItem[];
  totalCents: number;
  onClose: () => void;
  onCheckout: () => void;
  onSetQty: (item: CartItem, qty: number) => void;
  onRemove: (item: CartItem) => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/35 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-xl font-bold">Ihr Warenkorb</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors" aria-label="Schließen">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16 text-mute">Ihr Warenkorb ist leer.</div>
          ) : (
            items.map((item) => (
              <div key={`${item.product.id}:${item.variant?.id ?? ""}`} className="flex items-center gap-4 rounded-2xl border border-line p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surf">
                  {item.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.product.imageUrl} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-mute text-sm"><i className="fa-solid fa-cube" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{itemLabel(item)}</p>
                  <p className="text-xs text-mute tabular-nums">{formatEuro(itemPrice(item.product, item.variant))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSetQty(item, item.qty - 1)}
                    className="w-8 h-8 rounded-lg border border-line text-ink font-black flex items-center justify-center hover:bg-surf transition-colors"
                    aria-label="Menge verringern"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-black tabular-nums">{item.qty}</span>
                  <button
                    onClick={() => onSetQty(item, item.qty + 1)}
                    className="w-8 h-8 rounded-lg border border-line text-ink font-black flex items-center justify-center hover:bg-surf transition-colors"
                    aria-label="Menge erhöhen"
                  >
                    +
                  </button>
                </div>
                <div className="text-right min-w-16">
                  <p className="font-black tabular-nums">{formatEuro(itemPrice(item.product, item.variant) * item.qty)}</p>
                  <button
                    onClick={() => onRemove(item)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-5 border-t border-line">
          <div className="flex items-center justify-between mb-4">
            <span className="text-mute font-medium">Summe</span>
            <span className="text-3xl font-black tabular-nums">{formatEuro(totalCents)}</span>
          </div>
          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className="w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99] disabled:bg-tile disabled:text-mute"
          >
            Jetzt bezahlen
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutOverlay({
  vendorName,
  order,
  totalCents,
  method,
  paymentUrl,
  busy,
  error,
  rbankStatus,
  onSelectMethod,
  onBack,
}: {
  vendorName: string;
  order: OrderInfo | null;
  totalCents: number;
  method: PosPaymentMethod | null;
  paymentUrl: string | null;
  busy: boolean;
  error: string;
  rbankStatus: string | null;
  onSelectMethod: (m: PosPaymentMethod) => void;
  onBack: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-3xl max-h-full overflow-y-auto rounded-3xl border border-line bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <p className="text-xs text-mute uppercase tracking-widest">
              {vendorName} · POS{order ? ` · Bestellnummer #${order.posOrderNumber}` : ""}
            </p>
            <h2 className="text-xl font-bold">Bezahlung</h2>
          </div>
          <button onClick={onBack} className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors" aria-label="Zurück">
            <i className="fa-solid fa-arrow-left" />
          </button>
        </div>

        <div className="flex-1 p-6">
          <div className="text-right mb-6">
            <p className="text-4xl font-black tabular-nums">{formatEuro(totalCents)}</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!method ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POS_PAYMENT_METHODS.map((m) => {
                const meta = METHOD_LABELS[m];
                const belowMin =
                  (m === "TIPPIE" || m === "TERMINAL") && totalCents < POS_MIN_DIGITAL_PAYMENT_CENTS;
                if (belowMin) return null;
                return (
                  <button
                    key={m}
                    onClick={() => onSelectMethod(m)}
                    disabled={busy}
                    className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left transition-all hover:border-accent/50 hover:bg-surf active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="w-12 h-12 shrink-0 rounded-xl bg-accent/10 text-accent flex items-center justify-center text-xl">
                      <i className={meta.icon} />
                    </span>
                    <span>
                      <span className="block font-bold">{meta.title}</span>
                      <span className="block text-xs text-mute mt-0.5">{meta.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : method === "RBANK" || method === "TIPPIE" ? (
            <PaymentQrView method={method} paymentUrl={paymentUrl} rbankStatus={rbankStatus} />
          ) : method === "TERMINAL" ? (
            <TerminalView />
          ) : (
            <CashView totalCents={totalCents} orderNumber={order?.posOrderNumber ?? null} />
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentQrView({
  method,
  paymentUrl,
  rbankStatus,
}: {
  method: "RBANK" | "TIPPIE";
  paymentUrl: string | null;
  rbankStatus: string | null;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border border-line bg-white p-3 flex items-center justify-center">
        {paymentUrl ? <QrImage url={paymentUrl} /> : (
          <div className="flex flex-col items-center gap-3 text-mute">
            <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">Lädt QR-Code…</span>
          </div>
        )}
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">
        {method === "RBANK"
          ? "Mit dem Handy scannen und über die RBank-App bezahlen. Die Bestellung wird automatisch bestätigt."
          : "Mit dem Handy scannen und mit PayPal, Apple Pay oder Karte bezahlen."}
      </p>
      {method === "RBANK" && rbankStatus && rbankStatus !== "PENDING" && (
        <p className="mt-2 text-xs font-bold text-mute uppercase tracking-wide">{rbankStatus}</p>
      )}
      <div className="mt-6 flex items-center gap-3 text-mute">
        <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">
          {method === "RBANK" ? "Warte auf Zahlung…" : "Warte auf Bezahlung und Bestätigung…"}
        </span>
      </div>
    </div>
  );
}

function QrImage({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 512, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } })
      .then((d) => { if (!cancelled) setDataUrl(d); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [url]);

  if (!dataUrl) {
    return <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR-Code" className="w-full h-full" />;
}

function TerminalView() {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setPulse((p) => !p), 1200);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <div className={`mt-2 flex flex-col items-center justify-center w-48 h-48 rounded-3xl border transition-all ${pulse ? "border-accent shadow-[0_0_40px_-6px_var(--color-accent)]" : "border-line"}`}>
        <i className="fa-solid fa-id-card text-6xl text-accent" />
        <span className="mt-3 text-sm font-bold">Terminal ausgerufen</span>
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">
        Das Kartenterminal ist aktiviert. Karte bereit halten und an das Terminal halten.
      </p>
      <div className="mt-6 flex items-center gap-3 text-mute">
        <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Warte auf Bezahlung und Bestätigung…</span>
      </div>
    </div>
  );
}

function CashView({ totalCents, orderNumber }: { totalCents: number; orderNumber: number | null }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mt-2 w-48 h-48 rounded-3xl border border-line bg-surf flex flex-col items-center justify-center">
        <i className="fa-solid fa-money-bill-wave text-6xl text-accent" />
        <span className="mt-3 text-3xl font-black tabular-nums">{formatEuro(totalCents)}</span>
      </div>
      {orderNumber != null && (
        <div className="mt-6 rounded-2xl border-2 border-accent bg-accent/5 px-10 py-6">
          <p className="text-sm font-bold text-accent uppercase tracking-widest">Ihre Nummer</p>
          <p className="mt-1 text-7xl sm:text-8xl font-black text-accent tabular-nums leading-none">{orderNumber}</p>
        </div>
      )}
      <p className="mt-5 text-sm text-mute max-w-sm">Bitte den Betrag an der Kasse bezahlen und Ihre Nummer nennen.</p>
      <div className="mt-6 flex items-center gap-3 text-mute">
        <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Warte auf Bezahlung und Bestätigung…</span>
      </div>
    </div>
  );
}

function SuccessOverlay({
  totalCents,
  orderNumber,
  onNewOrder,
}: {
  totalCents: number;
  orderNumber: number;
  onNewOrder: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center rounded-3xl border border-line bg-white p-10 shadow-xl">
        <div className="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-accent text-white text-3xl">
          <i className="fa-solid fa-check" />
        </div>
        <h2 className="mt-6 text-3xl font-bold">Danke!</h2>
        <p className="mt-2 text-mute">Ihre Bestellung ist raus.</p>
        <div className="mt-6 rounded-2xl border-2 border-accent bg-accent/5 py-5">
          <p className="text-xs font-bold text-accent uppercase tracking-widest">Ihre Nummer</p>
          <p className="mt-1 text-5xl font-black text-accent tabular-nums">{orderNumber}</p>
        </div>
        <p className="mt-4 text-4xl font-black tabular-nums">{formatEuro(totalCents)}</p>
        <button
          onClick={onNewOrder}
          className="mt-8 w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
        >
          Neue Bestellung
        </button>
      </div>
    </div>
  );
}
