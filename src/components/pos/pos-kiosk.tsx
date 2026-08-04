"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "motion/react";
import {
  announce,
  clearAnnouncements,
  formatSpokenEuro,
  setSpeechEnabled,
} from "@/lib/pos-speech";
import {
  POS_MIN_DIGITAL_PAYMENT_CENTS,
  POS_PAYMENT_METHODS,
  type PosPaymentMethod,
} from "@/lib/pos";
import { formatEuro } from "@/lib/format";
import { LockScreen } from "@/components/pos/lock-screen";
import { SuccessBurst } from "@/components/kokonutui/success-burst";
import type { PosSettings } from "@/lib/pos-settings";

export type PosVariant = { id: string; name: string; priceCents: number };

export type PosProduct = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  price: number;
  isContainer: boolean;
  isTopping: boolean;
  variants: PosVariant[];
};

type Container = { key: string; product: PosProduct; label: string };

type CartItem = {
  product: PosProduct;
  variant: PosVariant | null;
  qty: number;
  containerKey: string | null;
  containerLabel: string | null;
};

type OrderInfo = {
  posGroupId: string;
  posConfirmToken: string;
  posOrderNumber: number;
  totalCents: number;
  itemCount: number;
};

const METHOD_LABELS: Record<
  PosPaymentMethod,
  { title: string; sub: string; icon: string }
> = {
  RBANK: {
    title: "RBank",
    sub: "Direkt am Bildschirm bezahlen",
    icon: "fa-solid fa-mobile-screen",
  },
  TIPPIE: {
    title: "PayPal / Apple Pay / Karte",
    sub: "QR-Code scannen & online zahlen",
    icon: "fa-solid fa-credit-card",
  },
  TERMINAL: {
    title: "Kartenterminal",
    sub: "Karte an das Terminal halten",
    icon: "fa-solid fa-id-card",
  },
  CASH: {
    title: "Bar",
    sub: "Betrag an der Kasse bezahlen",
    icon: "fa-solid fa-money-bill-wave",
  },
  GUTSCHEIN: {
    title: "Fyndo-Gutschein",
    sub: "Mit Gutschein ganz oder teilweise zahlen",
    icon: "fa-solid fa-gift",
  },
};

function itemPrice(product: PosProduct, variant: PosVariant | null) {
  return variant ? variant.priceCents : product.price;
}

function itemLabel(item: CartItem) {
  return item.variant
    ? `${item.product.title} (${item.variant.name})`
    : item.product.title;
}

function containerCount(containers: Container[], productId: string) {
  return containers.filter((c) => c.product.id === productId).length;
}

export function PosKiosk({
  vendorName,
  products,
  toppings,
  settings,
}: {
  vendorName: string;
  products: PosProduct[];
  toppings: PosProduct[];
  settings: PosSettings;
}) {
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toppingOpen, setToppingOpen] = useState(false);
  const [pickerProduct, setPickerProduct] = useState<PosProduct | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [method, setMethod] = useState<PosPaymentMethod | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [giftApplied, setGiftApplied] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    totalCents: number;
    orderNumber: number;
  } | null>(null);
  const [rbankStatus, setRbankStatus] = useState<string | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [wizardStep, setWizardStep] = useState<"containers" | "build" | null>(
    null,
  );
  const [activeContainerIndex, setActiveContainerIndex] = useState(0);
  const [lockOpen, setLockOpen] = useState(
    () => settings.lockScreenEnabled && settings.showOnLoad,
  );
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState(
    settings.lockWarningSeconds,
  );
  const [gridNonce, setGridNonce] = useState(0);
  const initialAnnounceRef = useRef(false);

  const containerMode = products.some((p) => p.isContainer);
  const containerProducts = products.filter((p) => p.isContainer);
  const scoopProducts = products.filter((p) => !p.isContainer);
  const toppingProducts = toppings;
  const activeContainer =
    wizardStep === "build" ? (containers[activeContainerIndex] ?? null) : null;

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
    if (lockOpen) return;
    const t = window.setTimeout(() => {
      if (containerMode) {
        announce(
          "welcome",
          `Willkommen bei ${vendorName}. Wählen Sie zuerst Ihre Becher oder Schüsseln.`,
        );
      } else {
        announce(
          "welcome",
          `Willkommen bei ${vendorName}. Wählen Sie Ihre Produkte.`,
        );
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [vendorName, lockOpen, containerMode]);

  useEffect(() => {
    if (!settings.lockScreenEnabled || lockOpen || countdownOpen) return;
    if (
      checkoutOpen ||
      cartOpen ||
      toppingOpen ||
      summaryOpen ||
      pickerProduct !== null ||
      done !== null
    )
      return;
    let lastActivity = Date.now();
    let timeoutId: number | null = null;
    function schedule() {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setCountdownLeft(settings.lockWarningSeconds);
        setCountdownOpen(true);
        announce(
          "idle-countdown",
          "Der Bildschirm wird gleich gesperrt. Wenn Sie noch da sind, tippen Sie auf Ich bin noch hier.",
        );
      }, settings.idleTimeoutSeconds * 1000);
    }
    function onActivity(force: boolean) {
      const now = Date.now();
      if (!force && now - lastActivity < 3000) return;
      lastActivity = now;
      schedule();
    }
    schedule();
    const immediate = () => onActivity(true);
    const move = () => onActivity(false);
    window.addEventListener("pointerdown", immediate);
    window.addEventListener("touchstart", immediate);
    window.addEventListener("keydown", immediate);
    window.addEventListener("mousemove", move);
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", immediate);
      window.removeEventListener("touchstart", immediate);
      window.removeEventListener("keydown", immediate);
      window.removeEventListener("mousemove", move);
    };
  }, [
    lockOpen,
    countdownOpen,
    checkoutOpen,
    cartOpen,
    toppingOpen,
    summaryOpen,
    pickerProduct,
    done,
    settings.lockScreenEnabled,
    settings.idleTimeoutSeconds,
    settings.lockWarningSeconds,
  ]);

  useEffect(() => {
    if (!countdownOpen) return;
    if (countdownLeft <= 0) {
      setCountdownOpen(false);
      setLockOpen(true);
      return;
    }
    const t = window.setTimeout(() => setCountdownLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdownOpen, countdownLeft]);

  function cancelCountdown() {
    setCountdownOpen(false);
  }

  const cartCount = useMemo(
    () => Array.from(cart.values()).reduce((s, i) => s + i.qty, 0),
    [cart],
  );
  const cartTotal = useMemo(
    () =>
      Array.from(cart.values()).reduce(
        (s, i) => s + itemPrice(i.product, i.variant) * i.qty,
        0,
      ),
    [cart],
  );
  const canCheckout = cartCount > 0 && cartTotal > 0;

  function cartKey(
    product: PosProduct,
    variant: PosVariant | null,
    containerKey: string | null = null,
  ) {
    return `${product.id}:${variant?.id ?? ""}:${containerKey ?? ""}`;
  }

  function setQty(
    product: PosProduct,
    variant: PosVariant | null,
    qty: number,
    container: Container | null = null,
  ) {
    const key = cartKey(product, variant, container?.key ?? null);
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(key);
      else
        next.set(key, {
          product,
          variant,
          qty,
          containerKey: container?.key ?? null,
          containerLabel: container?.label ?? null,
        });
      return next;
    });
  }

  function addProduct(
    product: PosProduct,
    variant: PosVariant | null,
    container: Container | null = null,
  ) {
    const key = cartKey(product, variant, container?.key ?? null);
    const current = cart.get(key)?.qty ?? 0;
    setQty(product, variant, current + 1, container);
    const label = variant ? `${product.title} ${variant.name}` : product.title;
    announce(
      "product-added",
      `${label}, ${formatSpokenEuro(itemPrice(product, variant))}.`,
    );
  }

  function removeProduct(
    product: PosProduct,
    variant: PosVariant | null,
    container: Container | null = null,
  ) {
    setQty(product, variant, 0, container);
    const label = variant ? `${product.title} ${variant.name}` : product.title;
    announce("product-removed", `${label} entfernt.`);
  }

  function addContainer(product: PosProduct) {
    setContainers((prev) => {
      const count = containerCount(prev, product.id);
      const container: Container = {
        key: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        product,
        label: `${product.title} ${count + 1}`,
      };
      setCart((prevCart) => {
        const next = new Map(prevCart);
        next.set(cartKey(product, null, container.key), {
          product,
          variant: null,
          qty: 1,
          containerKey: container.key,
          containerLabel: container.label,
        });
        return next;
      });
      return [...prev, container];
    });
    announce("product-added", `${product.title} hinzugefügt.`);
  }

  function removeContainer(product: PosProduct) {
    setContainers((prev) => {
      const last = [...prev].reverse().find((c) => c.product.id === product.id);
      if (!last) return prev;
      const next = prev.filter((c) => c.key !== last.key);
      setCart((prevCart) => {
        const after = new Map(prevCart);
        for (const key of Array.from(after.keys())) {
          if (key.endsWith(`:${last.key}`)) after.delete(key);
        }
        return after;
      });
      return next;
    });
    announce("product-removed", `${product.title} entfernt.`);
  }

  function enterBuildStep() {
    setWizardStep("build");
    setActiveContainerIndex(0);
    const first = containers[0];
    if (first) announce("container", `${first.label}. Wählen Sie Ihre Kugeln.`);
  }

  function setContainerQty(product: PosProduct, qty: number) {
    const current = containerCount(containers, product.id);
    if (qty > current) {
      for (let i = 0; i < qty - current; i++) addContainer(product);
    } else if (qty < current) {
      for (let i = 0; i < current - qty; i++) removeContainer(product);
    }
  }

  function advanceWizard() {
    if (activeContainerIndex + 1 < containers.length) {
      const nextIndex = activeContainerIndex + 1;
      setActiveContainerIndex(nextIndex);
      const c = containers[nextIndex];
      if (c) announce("container", `${c.label}. Wählen Sie Ihre Kugeln.`);
    } else {
      void startCheckout();
    }
  }

  function backWizard() {
    if (activeContainerIndex > 0) {
      setActiveContainerIndex(activeContainerIndex - 1);
    } else {
      setWizardStep("containers");
      setActiveContainerIndex(0);
    }
  }

  function resetWizard() {
    setContainers([]);
    setWizardStep(null);
    setActiveContainerIndex(0);
  }

  function openPicker(product: PosProduct) {
    setPickerProduct(product);
    announce(
      "select-payment",
      `${product.title}. Bitte Größe oder Variante wählen.`,
    );
  }

  function clearCart() {
    setCart(new Map());
  }

  function clearOrder() {
    clearCart();
    resetWizard();
  }

  async function startCheckout() {
    if (cart.size === 0 || cartTotal <= 0) return;
    setError("");
    setCartOpen(false);
    if (toppingProducts.length > 0) {
      setToppingOpen(true);
      announce(
        "toppings",
        "Noch etwas dazu? Wählen Sie Ihre Toppings oder tippen Sie auf Weiter.",
      );
      return;
    }
    setSummaryOpen(true);
    announce("checkout", "Zur Kasse. Bitte prüfen Sie Ihre Bestellung.");
  }

  function applyToppings(
    selected: { product: PosProduct; variant: PosVariant | null; qty: number }[],
  ) {
    const byKey = new Map(
      selected.map((s) => [
        s.variant ? `${s.product.id}:${s.variant.id}` : s.product.id,
        s,
      ]),
    );
    for (const topping of toppingProducts) {
      if (topping.variants.length === 0) {
        setQty(topping, null, byKey.get(topping.id)?.qty ?? 0);
      } else {
        for (const variant of topping.variants) {
          setQty(topping, variant, byKey.get(`${topping.id}:${variant.id}`)?.qty ?? 0);
        }
      }
    }
    setToppingOpen(false);
    setSummaryOpen(true);
    announce("checkout", "Zur Kasse. Bitte prüfen Sie Ihre Bestellung.");
  }

  function openPayment() {
    setSummaryOpen(false);
    setCheckoutOpen(true);
    announce("checkout", "Zur Kasse. Ihre Bestellnummer wird gerade vergeben.");
    void createOrder();
  }

  function backToSummary() {
    clearAnnouncements();
    void cancelPendingOrder();
    setCheckoutOpen(false);
    setSummaryOpen(true);
    setGiftApplied(0);
  }

  function resetForNewCustomer() {
    clearAnnouncements();
    void cancelPendingOrder();
    clearOrder();
    closeCheckout();
    setSummaryOpen(false);
    setGridNonce((n) => n + 1);
    if (settings.lockScreenEnabled) {
      setLockOpen(true);
    } else {
      announce("new-order", "Neue Bestellung. Wählen Sie Ihre Produkte.");
    }
  }

  async function createOrder(): Promise<OrderInfo | null> {
    if (order) return order;
    if (cart.size === 0 || cartTotal <= 0) return null;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: vendorName,
          items: Array.from(cart.values()).map((i) => ({
            productId: i.product.id,
            qty: i.qty,
            variantId: i.variant?.id ?? null,
            containerKey: i.containerKey,
            containerLabel: i.containerLabel,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Bestellung konnte nicht gestartet werden.");
        return null;
      }
      setOrder(data);
      announce("order-sent", `Ihre Bestellnummer ist ${data.posOrderNumber}.`);
      return data as OrderInfo;
    } catch {
      setError("Bestellung konnte nicht gestartet werden.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function selectMethod(m: PosPaymentMethod) {
    if (cart.size === 0 || cartTotal <= 0) return;
    setError("");
    let orderInfo = order;
    if (!orderInfo) {
      orderInfo = await createOrder();
      if (!orderInfo) return;
    }
    setBusy(true);
    setMethod(m);
    setPaymentUrl(null);
    setRbankStatus(null);
    if (m === "GUTSCHEIN") {
      setBusy(false);
      announce(
        "select-payment",
        "Fyndo-Gutschein. Bitte geben Sie den Gutscheincode ein.",
      );
      return;
    }
    try {
      const currentOrder = orderInfo;
      const payTotal = currentOrder.totalCents - giftApplied;
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
      announceByMethod(m, payTotal, currentOrder.posOrderNumber);
    } catch {
      setError("Zahlungsstart fehlgeschlagen.");
      setMethod(null);
    } finally {
      setBusy(false);
    }
  }

  async function applyGiftCard(code: string) {
    if (!order) return null;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/pos/orders/giftcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: order.posGroupId,
          posConfirmToken: order.posConfirmToken,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gutschein konnte nicht eingelöst werden.");
        return null;
      }
      setGiftApplied((prev) => prev + data.deduction);
      return { deduction: data.deduction, remainder: data.remainder };
    } catch {
      setError("Gutschein konnte nicht eingelöst werden.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmGiftCardFull() {
    if (!order) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/pos/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: order.posGroupId,
          posConfirmToken: order.posConfirmToken,
          method: "GUTSCHEIN",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Bestätigung fehlgeschlagen.");
        return;
      }
      onConfirmed(cartTotal, order.posOrderNumber);
    } catch {
      setError("Bestätigung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function announceByMethod(
    m: PosPaymentMethod,
    totalCents: number,
    orderNumber: number,
  ) {
    const total = formatSpokenEuro(totalCents);
    if (m === "RBANK")
      announce(
        "rbank-qr",
        `Bitte bezahlen Sie direkt am Bildschirm. Ihre Nummer ist ${orderNumber}.`,
      );
    else if (m === "TIPPIE")
      announce(
        "tippie-qr",
        `Bitte scannen Sie den QR-Code und zahlen Sie ${total} mit PayPal, Apple Pay oder Karte. Ihre Nummer ist ${orderNumber}.`,
      );
    else if (m === "TERMINAL")
      announce(
        "terminal-call",
        `Kartenzahlung. Das Terminal wird aufgerufen. Bitte halten Sie Ihre Karte an das Terminal.`,
      );
    else if (m === "CASH")
      announce(
        "cash",
        `Bitte zahlen Sie ${total} in bar an der Kasse. Ihre Nummer ist ${orderNumber}.`,
      );
    else if (m === "GUTSCHEIN")
      announce(
        "select-payment",
        `Bitte geben Sie den Gutscheincode ein. Ihre Nummer ist ${orderNumber}.`,
      );
  }

  function onConfirmed(totalCents: number, orderNumber: number) {
    setDone({ totalCents, orderNumber });
    announce(
      "payment-confirmed",
      `Vielen Dank! Ihre Bestellung ist raus. Ihre Nummer ist ${orderNumber}.`,
    );
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
          onConfirmed(
            data.totalCents,
            data.posOrderNumber ?? current.posOrderNumber,
          );
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

  async function cancelPendingOrder() {
    if (!order) return;
    const current = order;
    await fetch("/api/pos/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        posGroupId: current.posGroupId,
        posConfirmToken: current.posConfirmToken,
      }),
    }).catch(() => {});
    setOrder((prev) => (prev?.posGroupId === current.posGroupId ? null : prev));
  }

  function closeCheckout() {
    clearAnnouncements();
    setCheckoutOpen(false);
    setSummaryOpen(false);
    setOrder(null);
    setMethod(null);
    setPaymentUrl(null);
    setError("");
    setDone(null);
    setRbankStatus(null);
    setGiftApplied(0);
  }

  function lockAfterOrder() {
    clearAnnouncements();
    clearOrder();
    closeCheckout();
    setLockOpen(true);
  }

  function startFromLock() {
    clearAnnouncements();
    clearOrder();
    closeCheckout();
    setLockOpen(false);
    setGridNonce((n) => n + 1);
    announce(
      "welcome",
      containerMode
        ? `Willkommen bei ${vendorName}. Wählen Sie zuerst Ihre Becher oder Schüsseln.`
        : `Willkommen bei ${vendorName}. Wählen Sie Ihre Produkte.`,
    );
  }

  function resetForNext() {
    if (settings.lockScreenEnabled) {
      lockAfterOrder();
    } else {
      announce("new-order", "Neue Bestellung. Wählen Sie Ihre Produkte.");
      clearOrder();
      closeCheckout();
    }
  }

  useEffect(() => {
    if (
      done === null ||
      !settings.lockScreenEnabled ||
      settings.successAutoLockSeconds <= 0
    )
      return;
    const t = window.setTimeout(() => {
      lockAfterOrder();
    }, settings.successAutoLockSeconds * 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

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
              <i
                className={`${speakerOn ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}`}
              />
            </button>
            <button
              onClick={resetForNewCustomer}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${cartCount > 0 ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "border-red-100 text-red-400 hover:bg-red-50"}`}
              aria-label="Alles Löschen"
            >
              <i className="fa-solid fa-user-plus" />
              <span className="hidden sm:inline">Alles Löschen</span>
            </button>
            <button
              onClick={() => {
                setCartOpen(true);
                announce("cart", "Ihr Warenkorb.");
              }}
              className="relative flex items-center gap-3 rounded-full border border-line bg-white pl-3 pr-4 py-2 hover:border-accent hover:bg-surf transition-colors"
            >
              <i className="fa-solid fa-basket-shopping text-accent text-lg" />
              <div className="text-right">
                <div className="text-sm sm:text-base font-black text-accent tabular-nums leading-none">
                  {formatEuro(cartTotal)}
                </div>
                <div className="text-[11px] text-mute leading-tight mt-0.5">
                  {cartCount} Artikel
                </div>
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
        {containerMode && wizardStep !== "build" ? (
          <ContainerSelectionStep
            containerProducts={containerProducts}
            containers={containers}
            onAdd={addContainer}
            onSetQty={setContainerQty}
          />
        ) : containerMode && wizardStep === "build" && activeContainer ? (
          <ContainerBuildStep
            key={activeContainerIndex}
            containers={containers}
            activeIndex={activeContainerIndex}
            activeContainer={activeContainer}
            scoopProducts={scoopProducts}
            cart={cart}
            isLast={activeContainerIndex === containers.length - 1}
            onSelectIndex={setActiveContainerIndex}
            onBack={backWizard}
            onAddProduct={(product, variant) =>
              addProduct(product, variant, activeContainer)
            }
            onSetQty={(product, variant, qty) =>
              setQty(product, variant, qty, activeContainer)
            }
            onOpenPicker={(product) => openPicker(product)}
          />
        ) : products.length === 0 ? (
          <div className="text-center py-24 text-mute">
            Keine Produkte verfügbar.
          </div>
        ) : (
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6"
            key={gridNonce}
          >
            {products.map((product, index) => (
              <AnimatedTile key={product.id} index={index}>
                <ProductTile
                  product={product}
                  qty={
                    product.variants.length > 0
                      ? 0
                      : (cart.get(cartKey(product, null))?.qty ?? 0)
                  }
                  onAdd={() => {
                    if (product.variants.length > 0) openPicker(product);
                    else addProduct(product, null);
                  }}
                  onSetQty={(q) => setQty(product, null, q)}
                />
              </AnimatedTile>
            ))}
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-30 bg-white border-t border-line px-4 sm:px-6 py-4">
        <div className="max-w-[1440px] mx-auto">
          {containerMode && wizardStep !== "build" ? (
            <button
              onClick={enterBuildStep}
              disabled={containers.length === 0 || busy}
              className={`w-full max-w-2xl mx-auto flex items-center justify-between gap-4 rounded-full px-6 sm:px-8 py-4 sm:py-5 text-lg sm:text-xl font-bold transition-all ${
                containers.length > 0
                  ? "bg-accent text-white hover:bg-accent-hover active:scale-[0.99] shadow-lg"
                  : "bg-tile text-mute"
              }`}
            >
              <span>
                {containers.length === 0
                  ? "Bitte Becher oder Schüssel wählen"
                  : "Weiter: Kugeln wählen"}
              </span>
              <span className="tabular-nums">{containers.length}×</span>
            </button>
          ) : containerMode && wizardStep === "build" && activeContainer ? (
            <button
              onClick={advanceWizard}
              disabled={
                busy ||
                (activeContainerIndex === containers.length - 1 && !canCheckout)
              }
              className={`w-full max-w-2xl mx-auto flex items-center justify-between gap-4 rounded-full px-6 sm:px-8 py-4 sm:py-5 text-lg sm:text-xl font-bold transition-all bg-accent text-white hover:bg-accent-hover active:scale-[0.99] shadow-lg ${
                activeContainerIndex === containers.length - 1 && !canCheckout
                  ? "opacity-60"
                  : ""
              }`}
            >
              <span>
                {activeContainerIndex === containers.length - 1
                  ? "Fertig & bezahlen"
                  : `Weiter: ${containers[activeContainerIndex + 1]?.label}`}
              </span>
              <span className="tabular-nums">{formatEuro(cartTotal)}</span>
            </button>
          ) : (
            <button
              onClick={() => void startCheckout()}
              disabled={!canCheckout || busy}
              className={`w-full max-w-2xl mx-auto flex items-center justify-between gap-4 rounded-full px-6 sm:px-8 py-4 sm:py-5 text-lg sm:text-xl font-bold transition-all ${
                canCheckout
                  ? "bg-accent text-white hover:bg-accent-hover active:scale-[0.99] shadow-lg"
                  : "bg-tile text-mute"
              }`}
            >
              <span>
                {cartCount === 0 || cartTotal === 0
                  ? "Warenkorb ist leer"
                  : "Jetzt bezahlen"}
              </span>
              <span className="tabular-nums">{formatEuro(cartTotal)}</span>
            </button>
          )}
        </div>
      </footer>

      <AnimatePresence>
        {cartOpen && (
          <CartDrawer
            items={Array.from(cart.values())}
            totalCents={cartTotal}
            onClose={() => setCartOpen(false)}
            onCheckout={() => void startCheckout()}
            onSetQty={(item, q) =>
              setQty(
                item.product,
                item.variant,
                q,
                item.containerKey
                  ? {
                      key: item.containerKey,
                      product: item.product,
                      label: item.containerLabel ?? "",
                    }
                  : null,
              )
            }
            onRemove={(item) =>
              removeProduct(
                item.product,
                item.variant,
                item.containerKey
                  ? {
                      key: item.containerKey,
                      product: item.product,
                      label: item.containerLabel ?? "",
                    }
                  : null,
              )
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toppingOpen && (
          <ToppingOverlay
            toppings={toppingProducts}
            currentQty={(productId, variantId) => {
              const topping = toppingProducts.find((t) => t.id === productId);
              if (!topping) return 0;
              const variant = variantId
                ? (topping.variants.find((v) => v.id === variantId) ?? null)
                : null;
              return cart.get(cartKey(topping, variant))?.qty ?? 0;
            }}
            onBack={() => {
              clearAnnouncements();
              setToppingOpen(false);
            }}
            onConfirm={(selected) => applyToppings(selected)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {summaryOpen && (
          <OrderSummaryOverlay
            items={Array.from(cart.values())}
            totalCents={cartTotal}
            onBack={() => setSummaryOpen(false)}
            onPay={openPayment}
            onNewCustomer={resetForNewCustomer}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pickerProduct && (
          <VariantPickerOverlay
            product={pickerProduct}
            onPick={(variant) => {
              addProduct(pickerProduct, variant, activeContainer);
              setPickerProduct(null);
            }}
            onClose={() => setPickerProduct(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutOpen && done === null && (
          <CheckoutOverlay
            vendorName={vendorName}
            order={order}
            totalCents={cartTotal - giftApplied}
            giftApplied={giftApplied}
            method={method}
            paymentUrl={paymentUrl}
            busy={busy}
            error={error}
            rbankStatus={rbankStatus}
            onSelectMethod={(m) => void selectMethod(m)}
            onApplyGiftCard={(code) => applyGiftCard(code)}
            onConfirmGiftCardFull={() => void confirmGiftCardFull()}
            onRetry={() => void createOrder()}
            onBack={
              method
                ? () => {
                    clearAnnouncements();
                    setMethod(null);
                    setPaymentUrl(null);
                    setRbankStatus(null);
                  }
                : backToSummary
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutOpen && done !== null && (
          <SuccessOverlay
            totalCents={done.totalCents}
            orderNumber={done.orderNumber}
            onNewOrder={resetForNext}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lockOpen && (
          <LockScreen
            vendorName={vendorName}
            media={settings.media}
            onStart={startFromLock}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {countdownOpen && !lockOpen && (
          <IdleCountdownOverlay
            seconds={countdownLeft}
            onStay={cancelCountdown}
          />
        )}
      </AnimatePresence>
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
  const minPrice = hasVariants
    ? Math.min(...product.variants.map((v) => v.priceCents))
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAdd();
        }
      }}
      className="group flex h-full flex-col items-stretch rounded-2xl border border-line bg-white p-3 sm:p-4 text-left transition-all hover:border-accent/50 hover:shadow-lg active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-surf mb-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-mute text-xl">
            <i className="fa-solid fa-cube" />
          </div>
        )}
      </div>
      <div className="mt-auto">
        <h3 className="font-bold text-sm sm:text-base leading-tight line-clamp-2">
          {product.title}
        </h3>
        <p className="mt-1 text-lg sm:text-xl font-black text-ink tabular-nums">
          {minPrice != null
            ? `ab ${formatEuro(minPrice)}`
            : formatEuro(product.price)}
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
          <span className="text-sm font-black text-accent tabular-nums">
            {qty}
          </span>
          <button
            onClick={() => onSetQty(qty + 1)}
            className="w-9 h-9 rounded-lg bg-white text-accent font-black flex items-center justify-center shadow-sm hover:bg-accent hover:text-white transition-colors"
            aria-label="Menge erhöhen"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function ContainerSelectionStep({
  containerProducts,
  containers,
  onAdd,
  onSetQty,
}: {
  containerProducts: PosProduct[];
  containers: Container[];
  onAdd: (product: PosProduct) => void;
  onSetQty: (product: PosProduct, qty: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
        Wähle deine Becher & Schüsseln
      </h2>
      <p className="text-sm text-mute mb-6">
        Tippe, wie viele Becher oder Schüsseln du möchtest. Danach wählst du für
        jeden die Kugeln.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {containerProducts.map((product, index) => (
          <AnimatedTile key={product.id} index={index}>
            <ProductTile
              product={product}
              qty={containerCount(containers, product.id)}
              onAdd={() => onAdd(product)}
              onSetQty={(q) => onSetQty(product, q)}
            />
          </AnimatedTile>
        ))}
      </div>
      {containers.length > 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-black uppercase tracking-widest text-mute mb-2">
            Gewählt
          </p>
          <div className="flex flex-wrap gap-2">
            {containers.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent"
              >
                <i className="fa-solid fa-cup-togo" />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ContainerBuildStep({
  containers,
  activeIndex,
  activeContainer,
  scoopProducts,
  cart,
  isLast,
  onSelectIndex,
  onBack,
  onAddProduct,
  onSetQty,
  onOpenPicker,
}: {
  containers: Container[];
  activeIndex: number;
  activeContainer: Container;
  scoopProducts: PosProduct[];
  cart: Map<string, CartItem>;
  isLast: boolean;
  onSelectIndex: (index: number) => void;
  onBack: () => void;
  onAddProduct: (product: PosProduct, variant: PosVariant | null) => void;
  onSetQty: (
    product: PosProduct,
    variant: PosVariant | null,
    qty: number,
  ) => void;
  onOpenPicker: (product: PosProduct) => void;
}) {
  const containerKey = (
    c: Container,
    product: PosProduct,
    variant: PosVariant | null,
  ) => `${product.id}:${variant?.id ?? ""}:${c.key}`;

  return (
    <motion.div
      key={activeContainer.key}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-11 h-11 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
          aria-label="Zurück"
        >
          <i className="fa-solid fa-arrow-left" />
        </button>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2">
            {containers.map((c, idx) => (
              <button
                key={c.key}
                onClick={() => onSelectIndex(idx)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                  idx === activeIndex
                    ? "bg-accent text-white"
                    : "border border-line text-mute hover:bg-surf"
                }`}
              >
                <i className="fa-solid fa-cup-togo" />
                {c.label}
                {idx === activeIndex && (
                  <span className="text-xs font-bold opacity-80">· aktiv</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
        {activeContainer.label}
      </h2>
      <p className="text-sm text-mute mb-6">
        {isLast
          ? "Tippe die Kugeln für diesen Becher. Danach kannst du direkt bezahlen."
          : "Tippe die Kugeln für diesen Becher."}
      </p>

      {scoopProducts.length === 0 ? (
        <div className="text-center py-16 text-mute">
          Keine Kugeln verfügbar.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {scoopProducts.map((product, index) => (
            <AnimatedTile key={product.id} index={index}>
              <ProductTile
                product={product}
                qty={
                  product.variants.length > 0
                    ? 0
                    : (cart.get(containerKey(activeContainer, product, null))
                        ?.qty ?? 0)
                }
                onAdd={() => {
                  if (product.variants.length > 0) onOpenPicker(product);
                  else onAddProduct(product, null);
                }}
                onSetQty={(q) => onSetQty(product, null, q)}
              />
            </AnimatedTile>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function IdleCountdownOverlay({
  seconds,
  onStay,
}: {
  seconds: number;
  onStay: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 sm:p-10 text-center shadow-2xl">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-accent text-accent text-5xl font-black tabular-nums">
          {Math.max(seconds, 0)}
        </div>
        <h2 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight">
          Noch da?
        </h2>
        <p className="mt-2 text-sm text-mute">
          Der Bildschirm sperrt sich gleich. Tippe auf „Ich bin noch hier“, um
          weiterzubestellen.
        </p>
        <button
          onClick={onStay}
          className="mt-8 w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
        >
          Ich bin noch hier
        </button>
      </div>
    </div>
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
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-full max-w-lg max-h-full overflow-y-auto rounded-3xl border border-line bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{product.title}</h2>
            <p className="text-xs text-mute">Wähle eine Variante</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label="Schließen"
          >
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
              <span className="text-xl font-black tabular-nums">
                {formatEuro(variant.priceCents)}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ToppingOverlay({
  toppings,
  currentQty,
  onBack,
  onConfirm,
}: {
  toppings: PosProduct[];
  currentQty: (productId: string, variantId: string | null) => number;
  onBack: () => void;
  onConfirm: (
    selected: { product: PosProduct; variant: PosVariant | null; qty: number }[],
  ) => void;
}) {
  const [qtys, setQtys] = useState<Map<string, number>>(
    () =>
      new Map(
        toppings.flatMap((t) =>
          t.variants.length > 0
            ? t.variants.map((v) => [`${t.id}:${v.id}`, currentQty(t.id, v.id)])
            : [[t.id, currentQty(t.id, null)]],
        ),
      ),
  );
  const [activeTopping, setActiveTopping] = useState<PosProduct | null>(null);

  function priceFor(topping: PosProduct, variant: PosVariant | null) {
    return variant ? variant.priceCents : topping.price;
  }

  const selectedTotal = toppings.reduce((sum, t) => {
    if (t.variants.length > 0) {
      return (
        sum +
        t.variants.reduce(
          (s, v) => s + (qtys.get(`${t.id}:${v.id}`) ?? 0) * v.priceCents,
          0,
        )
      );
    }
    return sum + (qtys.get(t.id) ?? 0) * t.price;
  }, 0);
  const selectedCount = Array.from(qtys.values()).reduce(
    (sum, q) => sum + q,
    0,
  );

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onBack();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onBack]);

  function buildSelection(): {
    product: PosProduct;
    variant: PosVariant | null;
    qty: number;
  }[] {
    const out: { product: PosProduct; variant: PosVariant | null; qty: number }[] =
      [];
    for (const t of toppings) {
      if (t.variants.length > 0) {
        for (const v of t.variants) {
          const qty = qtys.get(`${t.id}:${v.id}`) ?? 0;
          if (qty > 0) out.push({ product: t, variant: v, qty });
        }
      } else {
        const qty = qtys.get(t.id) ?? 0;
        if (qty > 0) out.push({ product: t, variant: null, qty });
      }
    }
    return out;
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-full max-w-3xl max-h-full overflow-y-auto rounded-3xl border border-line bg-white shadow-xl flex flex-col"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="min-w-0">
            <p className="text-xs text-mute uppercase tracking-widest">
              Extras
            </p>
            <h2 className="text-xl font-bold truncate">
              {activeTopping
                ? activeTopping.title
                : "Noch etwas dazu?"}
            </h2>
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label="Schließen"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 p-6">
          {activeTopping ? (
            <div className="space-y-3">
              <p className="text-sm text-mute">
                Tippen Sie auf eine Variante, um sie hinzuzufügen.
              </p>
              {activeTopping.variants.map((variant) => {
                const key = `${activeTopping.id}:${variant.id}`;
                const qty = qtys.get(key) ?? 0;
                return (
                  <button
                    key={variant.id}
                    onClick={() =>
                      setQtys((prev) => {
                        const next = new Map(prev);
                        next.set(key, (next.get(key) ?? 0) + 1);
                        return next;
                      })
                    }
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 text-left transition-all hover:border-accent/50 hover:bg-surf active:scale-[0.98]"
                  >
                    <span className="font-bold">{variant.name}</span>
                    <div className="flex items-center gap-3">
                      {qty > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQtys((prev) => {
                              const next = new Map(prev);
                              next.set(
                                key,
                                Math.max((next.get(key) ?? 0) - 1, 0),
                              );
                              return next;
                            });
                          }}
                          className="w-8 h-8 rounded-lg border border-line text-ink font-black flex items-center justify-center hover:bg-surf transition-colors"
                          aria-label={`${variant.name} verringern`}
                        >
                          −
                        </button>
                      )}
                      {qty > 0 && (
                        <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-full bg-accent px-2 text-xs font-black text-white tabular-nums">
                          {qty}
                        </span>
                      )}
                      <span className="text-xl font-black tabular-nums">
                        {formatEuro(variant.priceCents)}
                      </span>
                    </div>
                  </button>
                );
              })}
              <button
                onClick={() => setActiveTopping(null)}
                className="w-full rounded-full border border-line px-8 py-3.5 text-base font-bold text-ink hover:bg-surf transition-colors"
              >
                <i className="fa-solid fa-arrow-left mr-2" />
                Zurück zu den Extras
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {toppings.map((topping) => {
                const hasVariants = topping.variants.length > 0;
                const qty = hasVariants
                  ? topping.variants.reduce(
                      (s, v) => s + (qtys.get(`${topping.id}:${v.id}`) ?? 0),
                      0,
                    )
                  : (qtys.get(topping.id) ?? 0);
                const minPrice = hasVariants
                  ? Math.min(...topping.variants.map((v) => v.priceCents))
                  : topping.price;
                return (
                  <div
                    key={topping.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (hasVariants) {
                        setActiveTopping(topping);
                        return;
                      }
                      setQtys((prev) => {
                        const next = new Map(prev);
                        next.set(topping.id, (next.get(topping.id) ?? 0) + 1);
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (hasVariants) setActiveTopping(topping);
                        else {
                          const key = topping.id;
                          setQtys((prev) => {
                            const next = new Map(prev);
                            next.set(key, (next.get(key) ?? 0) + 1);
                            return next;
                          });
                        }
                      }
                    }}
                    className="group flex h-full flex-col items-stretch rounded-2xl border border-line bg-white p-3 sm:p-4 text-left transition-all hover:border-accent/50 hover:shadow-lg active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-xl bg-surf mb-3">
                      {topping.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={topping.imageUrl}
                          alt={topping.title}
                          className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-mute text-xl">
                          <i className="fa-solid fa-mug-saucer" />
                        </div>
                      )}
                    </div>
                    <div className="mt-auto">
                      <h3 className="font-bold text-sm sm:text-base leading-tight line-clamp-2">
                        {topping.title}
                      </h3>
                      <p className="mt-1 text-lg sm:text-xl font-black text-ink tabular-nums">
                        {hasVariants
                          ? `ab ${formatEuro(minPrice)}`
                          : formatEuro(topping.price)}
                      </p>
                      {hasVariants && (
                        <span className="mt-1 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                          {topping.variants.length} Varianten
                        </span>
                      )}
                    </div>
                    {qty > 0 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 flex items-center justify-between rounded-xl bg-accent/10 px-2 py-1.5"
                      >
                        <button
                          onClick={() => {
                            if (hasVariants) {
                              setActiveTopping(topping);
                              return;
                            }
                            setQtys((prev) => {
                              const next = new Map(prev);
                              next.set(
                                topping.id,
                                Math.max((next.get(topping.id) ?? 0) - 1, 0),
                              );
                              return next;
                            });
                          }}
                          className="w-9 h-9 rounded-lg bg-white text-accent font-black flex items-center justify-center shadow-sm hover:bg-accent hover:text-white transition-colors"
                          aria-label="Menge verringern"
                        >
                          −
                        </button>
                        <span className="text-sm font-black text-accent tabular-nums">
                          {qty}
                        </span>
                        <button
                          onClick={() => {
                            if (hasVariants) {
                              setActiveTopping(topping);
                              return;
                            }
                            setQtys((prev) => {
                              const next = new Map(prev);
                              next.set(topping.id, (next.get(topping.id) ?? 0) + 1);
                              return next;
                            });
                          }}
                          className="w-9 h-9 rounded-lg bg-white text-accent font-black flex items-center justify-center shadow-sm hover:bg-accent hover:text-white transition-colors"
                          aria-label="Menge erhöhen"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-5 border-t border-line">
          <div className="flex items-center justify-between mb-4">
            <span className="text-mute font-medium">
              {selectedCount > 0
                ? `${selectedCount} extra`
                : "Keine Extras ausgewählt"}
            </span>
            <span className="text-2xl font-black tabular-nums">
              {formatEuro(selectedTotal)}
            </span>
          </div>
          <button
            onClick={() => onConfirm(buildSelection())}
            className="w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
          >
            Weiter zur Bestellübersicht
          </button>
          <div className="mt-3 text-center">
            <button
              onClick={onBack}
              className="text-sm font-bold text-mute hover:text-ink transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-1.5" />
              Weiter bestellen
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OrderSummaryOverlay({
  items,
  totalCents,
  onBack,
  onPay,
  onNewCustomer,
}: {
  items: CartItem[];
  totalCents: number;
  onBack: () => void;
  onPay: () => void;
  onNewCustomer: () => void;
}) {
  const groups: { label: string | null; items: CartItem[] }[] = [];
  for (const item of items) {
    const label = item.containerLabel;
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(item);
    else groups.push({ label, items: [item] });
  }

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onBack();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onBack]);

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <motion.div
      className="fixed inset-0 z-[45] bg-black/35 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-full max-w-xl max-h-full overflow-hidden rounded-3xl border border-line bg-white shadow-xl flex flex-col"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
          <div>
            <p className="text-xs text-mute uppercase tracking-widest">
              Bestellübersicht
            </p>
            <h2 className="text-xl font-bold">Bitte prüfen</h2>
            {itemCount > 0 && (
              <p className="text-xs text-mute mt-0.5 tabular-nums">
                {itemCount} Artikel
              </p>
            )}
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label="Weiter bestellen"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-tile flex items-center justify-center text-mute text-2xl">
              <i className="fa-solid fa-basket-shopping" />
            </div>
            <p className="font-bold">Ihr Warenkorb ist leer</p>
            <p className="text-sm text-mute max-w-xs">
              Fügen Sie zuerst ein Produkt hinzu, dann erscheint es hier.
            </p>
            <button
              onClick={onBack}
              className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-accent-hover"
            >
              Weiter bestellen
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-2">
            {groups.map((group) => (
              <div
                key={group.label ?? "plain"}
                className={group.label ? "py-4" : "py-2"}
              >
                {group.label && (
                  <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-accent">
                    <i className="fa-solid fa-cup-togo" />
                    {group.label}
                  </p>
                )}
                <ul className="divide-y divide-line">
                  {group.items.map((item) => {
                    const unit = itemPrice(item.product, item.variant);
                    return (
                      <li
                        key={`${item.product.id}:${item.variant?.id ?? ""}:${item.containerKey ?? ""}`}
                        className="flex items-center gap-4 py-3"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-tile">
                          {item.product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.imageUrl}
                              alt=""
                              className="h-full w-full object-contain p-1.5"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-mute text-xs">
                              <i className="fa-solid fa-cube" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm truncate">
                              {itemLabel(item)}
                            </p>
                            {item.product.isTopping && (
                              <span className="shrink-0 rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-600 uppercase tracking-wide">
                                Extra
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-mute tabular-nums">
                            {formatEuro(unit)}
                            {item.qty > 1 ? ` × ${item.qty}` : ""}
                          </p>
                        </div>
                        <span className="font-black tabular-nums text-sm">
                          {formatEuro(unit * item.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-line bg-surf/60">
            <div className="flex items-end justify-between mb-4">
              <span className="font-medium text-mute">Summe</span>
              <span className="text-3xl font-black tabular-nums leading-none">
                {formatEuro(totalCents)}
              </span>
            </div>
            <button
              onClick={onPay}
              className="w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
            >
              Weiter zur Bezahlung
            </button>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={onBack}
                className="text-sm font-bold text-mute hover:text-ink transition-colors"
              >
                <i className="fa-solid fa-arrow-left mr-1.5" />
                Weiter bestellen
              </button>
              <button
                onClick={onNewCustomer}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
              >
                <i className="fa-solid fa-rotate-left mr-1.5" />
                Alles löschen
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
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
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const groups: { label: string | null; items: CartItem[] }[] = [];
  for (const item of items) {
    const label = item.containerLabel;
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex justify-end bg-black/35 backdrop-blur-sm"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-xl font-bold">Ihr Warenkorb</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label="Schließen"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16 text-mute">
              Ihr Warenkorb ist leer.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label ?? "plain"}>
                {group.label && (
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-accent">
                    {group.label}
                  </p>
                )}
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div
                      key={`${item.product.id}:${item.variant?.id ?? ""}:${item.containerKey ?? ""}`}
                      className="flex items-center gap-4 rounded-2xl border border-line p-3"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surf">
                        {item.product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.product.imageUrl}
                            alt=""
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-mute text-sm">
                            <i className="fa-solid fa-cube" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">
                          {itemLabel(item)}
                        </p>
                        <p className="text-xs text-mute tabular-nums">
                          {formatEuro(itemPrice(item.product, item.variant))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSetQty(item, item.qty - 1)}
                          className="w-8 h-8 rounded-lg border border-line text-ink font-black flex items-center justify-center hover:bg-surf transition-colors"
                          aria-label="Menge verringern"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-black tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => onSetQty(item, item.qty + 1)}
                          className="w-8 h-8 rounded-lg border border-line text-ink font-black flex items-center justify-center hover:bg-surf transition-colors"
                          aria-label="Menge erhöhen"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right min-w-16">
                        <p className="font-black tabular-nums">
                          {formatEuro(
                            itemPrice(item.product, item.variant) * item.qty,
                          )}
                        </p>
                        <button
                          onClick={() => onRemove(item)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-5 border-t border-line">
          <div className="flex items-center justify-between mb-4">
            <span className="text-mute font-medium">Summe</span>
            <span className="text-3xl font-black tabular-nums">
              {formatEuro(totalCents)}
            </span>
          </div>
          <button
            onClick={onCheckout}
            disabled={items.length === 0 || totalCents <= 0}
            className="w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99] disabled:bg-tile disabled:text-mute"
          >
            Jetzt bezahlen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CheckoutOverlay({
  vendorName,
  order,
  totalCents,
  giftApplied,
  method,
  paymentUrl,
  busy,
  error,
  rbankStatus,
  onSelectMethod,
  onApplyGiftCard,
  onConfirmGiftCardFull,
  onRetry,
  onBack,
}: {
  vendorName: string;
  order: OrderInfo | null;
  totalCents: number;
  giftApplied: number;
  method: PosPaymentMethod | null;
  paymentUrl: string | null;
  busy: boolean;
  error: string;
  rbankStatus: string | null;
  onSelectMethod: (m: PosPaymentMethod) => void;
  onApplyGiftCard: (code: string) => Promise<{ deduction: number; remainder: number } | null>;
  onConfirmGiftCardFull: () => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  const displayNumber = order?.posOrderNumber ?? null;
  return (
    <motion.div
      className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-full max-w-3xl max-h-full overflow-y-auto rounded-3xl border border-line bg-white shadow-xl flex flex-col"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <p className="text-xs text-mute uppercase tracking-widest">
              {vendorName} · POS
              {displayNumber != null
                ? ` · Bestellnummer #${displayNumber}`
                : ""}
            </p>
            <h2 className="text-xl font-bold">Bezahlung</h2>
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label="Zurück"
          >
            <i className="fa-solid fa-arrow-left" />
          </button>
        </div>

        <div className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="text-right flex-1">
              <p className="text-4xl font-black tabular-nums">
                {formatEuro(totalCents)}
              </p>
            </div>
            {displayNumber != null && (
              <div className="rounded-2xl border-2 border-accent bg-accent/5 px-6 py-2.5 text-center shrink-0">
                <p className="text-[11px] font-bold text-accent uppercase tracking-widest">
                  Ihre Nummer
                </p>
                <p className="text-4xl font-black text-accent tabular-nums leading-none mt-0.5">
                  {displayNumber}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {order === null ? (
              <motion.div
                key="number"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex flex-col items-center text-center py-8">
                  {busy ? (
                    <>
                      <div className="h-10 w-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                      <p className="mt-5 text-sm font-bold text-mute">
                        Bestellnummer wird vergeben…
                      </p>
                    </>
                  ) : error ? (
                    <>
                      <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400" />
                      <p className="mt-4 text-sm text-mute max-w-sm">
                        Die Bestellung konnte nicht gestartet werden.
                      </p>
                      <button
                        onClick={onRetry}
                        className="mt-6 rounded-full bg-accent px-8 py-3.5 text-base font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
                      >
                        Erneut versuchen
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                      <p className="mt-5 text-sm font-bold text-mute">
                        Bestellnummer wird vergeben…
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            ) : !method ? (
              <motion.div
                key="methods"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {POS_PAYMENT_METHODS.map((m) => {
                    const meta = METHOD_LABELS[m];
                    const belowMin =
                      (m === "TIPPIE" || m === "TERMINAL") &&
                      totalCents < POS_MIN_DIGITAL_PAYMENT_CENTS;
                    return (
                      <motion.button
                        key={m}
                        onClick={() => onSelectMethod(m)}
                        disabled={busy || belowMin}
                        className={`flex items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                          belowMin
                            ? "grayscale"
                            : "hover:border-accent/50 hover:bg-surf active:scale-[0.98]"
                        }`}
                        whileHover={belowMin ? undefined : { scale: 1.02 }}
                        whileTap={belowMin ? undefined : { scale: 0.97 }}
                      >
                        <span
                          className={`w-12 h-12 shrink-0 rounded-xl bg-accent/10 flex items-center justify-center text-xl ${belowMin ? "text-mute" : "text-accent"}`}
                        >
                          <i className={meta.icon} />
                        </span>
                        <span>
                          <span className="block font-bold">{meta.title}</span>
                          <span className="block text-xs text-mute mt-0.5">
                            {belowMin
                              ? `Erst ab ${formatEuro(POS_MIN_DIGITAL_PAYMENT_CENTS)} möglich`
                              : meta.sub}
                          </span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : method === "RBANK" || method === "TIPPIE" ? (
              <motion.div
                key={method}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <PaymentQrView
                  method={method}
                  paymentUrl={paymentUrl}
                  rbankStatus={rbankStatus}
                />
              </motion.div>
            ) : method === "GUTSCHEIN" ? (
              <motion.div
                key="giftcard"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <GiftCardView
                  totalCents={totalCents}
                  giftApplied={giftApplied}
                  busy={busy}
                  error={error}
                  onApply={onApplyGiftCard}
                  onConfirmFull={onConfirmGiftCardFull}
                  onPickMethod={onSelectMethod}
                />
              </motion.div>
            ) : method === "TERMINAL" ? (
              <motion.div
                key="terminal"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <TerminalView />
              </motion.div>
            ) : (
              <motion.div
                key="cash"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <CashView totalCents={totalCents} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GiftCardView({
  totalCents,
  giftApplied,
  busy,
  error,
  onApply,
  onConfirmFull,
  onPickMethod,
}: {
  totalCents: number;
  giftApplied: number;
  busy: boolean;
  error: string;
  onApply: (code: string) => Promise<{ deduction: number; remainder: number } | null>;
  onConfirmFull: () => void;
  onPickMethod: (m: PosPaymentMethod) => void;
}) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{
    deduction: number;
    remainder: number;
  } | null>(null);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");
    if (!code.trim()) {
      setLocalError("Bitte einen Gutscheincode eingeben.");
      return;
    }
    const applied = await onApply(code.trim());
    if (applied) setResult(applied);
  }

  const remainderMethods = POS_PAYMENT_METHODS.filter((m) => m !== "GUTSCHEIN");

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surf/60 p-6">
        {result ? (
          <>
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-50 text-green-600 text-2xl">
                <i className="fa-solid fa-check" />
              </div>
              <p className="mt-3 font-bold">
                Gutschein eingelöst
              </p>
              <p className="mt-1 text-sm text-mute">
                {formatEuro(result.deduction)} abgezogen
              </p>
              <div className="mt-4 w-full flex items-center justify-between rounded-xl bg-white border border-line px-4 py-3">
                <span className="text-sm font-medium text-mute">
                  Restbetrag
                </span>
                <span className="text-2xl font-black tabular-nums">
                  {formatEuro(result.remainder)}
                </span>
              </div>
            </div>
            {result.remainder === 0 ? (
              <button
                onClick={onConfirmFull}
                disabled={busy}
                className="mt-5 w-full rounded-full bg-accent px-8 py-3.5 text-base font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? "Wird bestätigt…" : "Bestellung abschließen"}
              </button>
            ) : (
              <>
                <p className="mt-5 text-xs font-bold text-mute uppercase tracking-widest">
                  Restbetrag bezahlen mit
                </p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {remainderMethods.map((m) => {
                    const meta = METHOD_LABELS[m];
                    return (
                      <button
                        key={m}
                        onClick={() => onPickMethod(m)}
                        disabled={busy}
                        className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-left transition-all hover:border-accent/50 hover:bg-surf active:scale-[0.98] disabled:opacity-50"
                      >
                        <span className="w-9 h-9 shrink-0 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                          <i className={meta.icon} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold truncate">
                            {meta.title}
                          </span>
                          <span className="block text-[11px] text-mute truncate">
                            {meta.sub}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    setResult(null);
                    setCode("");
                    setLocalError("");
                  }}
                  className="mt-4 text-sm font-bold text-mute hover:text-ink transition-colors"
                >
                  <i className="fa-solid fa-gift mr-1.5" />
                  Weiteren Gutschein einlösen
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 text-accent text-2xl">
              <i className="fa-solid fa-gift" />
            </div>
            <p className="mt-3 font-bold">Gutscheincode eingeben</p>
            <p className="mt-1 text-sm text-mute">
              {giftApplied > 0
                ? `${formatEuro(giftApplied)} wurden bereits abgezogen.`
                : `Deckt den Betrag von ${formatEuro(totalCents)} ganz oder teilweise ab.`}
            </p>
            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="FYNDO-XXXX-XXXX"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-center font-black tracking-widest uppercase outline-none focus:border-accent transition-colors disabled:opacity-50"
              />
              {localError && (
                <p className="mt-2 text-xs font-bold text-red-600">
                  {localError}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-3 w-full rounded-full bg-accent px-8 py-3.5 text-base font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? "Prüfe…" : "Einlösen"}
              </button>
            </form>
          </>
        )}
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">
        Geben Sie den Code vom Fyndo-Gutschein ein. Der Betrag wird direkt von
        Ihrer Bestellung abgezogen.
      </p>
      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
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
  if (method === "RBANK") {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-full max-w-xl h-[520px] rounded-2xl border border-line bg-white overflow-hidden">
          {paymentUrl ? (
            <iframe
              src={paymentUrl}
              title="RBank Checkout"
              className="w-full h-full border-0"
              allow="payment"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-mute">
              <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold">Lädt Checkout…</span>
            </div>
          )}
        </div>
        <p className="mt-5 text-sm text-mute max-w-sm">
          Bezahlen Sie direkt am Bildschirm. Die Bestellung wird automatisch
          bestätigt.
        </p>
        {rbankStatus && rbankStatus !== "PENDING" && (
          <p className="mt-2 text-xs font-bold text-mute uppercase tracking-wide">
            {rbankStatus}
          </p>
        )}
        <div className="mt-6 flex items-center gap-3 text-mute">
          <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Warte auf Zahlung…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border border-line bg-white p-3 flex items-center justify-center">
        {paymentUrl ? (
          <QrImage url={paymentUrl} />
        ) : (
          <div className="flex flex-col items-center gap-3 text-mute">
            <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">Lädt QR-Code…</span>
          </div>
        )}
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">
        Mit dem Handy scannen und mit PayPal, Apple Pay oder Karte bezahlen.
      </p>
      <div className="mt-6 flex items-center gap-3 text-mute">
        <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">
          Warte auf Bezahlung und Bestätigung…
        </span>
      </div>
    </div>
  );
}

function QrImage({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) {
    return (
      <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    );
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
      <div
        className={`mt-2 flex flex-col items-center justify-center w-48 h-48 rounded-3xl border transition-all ${pulse ? "border-accent shadow-[0_0_40px_-6px_var(--color-accent)]" : "border-line"}`}
      >
        <i className="fa-solid fa-id-card text-6xl text-accent" />
        <span className="mt-3 text-sm font-bold">Terminal ausgerufen</span>
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">
        Das Kartenterminal ist aktiviert. Karte bereit halten und an das
        Terminal halten.
      </p>
      <div className="mt-6 flex items-center gap-3 text-mute">
        <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">
          Warte auf Bezahlung und Bestätigung…
        </span>
      </div>
    </div>
  );
}

function CashView({ totalCents }: { totalCents: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mt-2 w-48 h-48 rounded-3xl border border-line bg-surf flex flex-col items-center justify-center">
        <i className="fa-solid fa-money-bill-wave text-6xl text-accent" />
        <span className="mt-3 text-3xl font-black tabular-nums">
          {formatEuro(totalCents)}
        </span>
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">
        Bitte den Betrag an der Kasse bezahlen und Ihre Nummer nennen.
      </p>
      <div className="mt-6 flex items-center gap-3 text-mute">
        <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">
          Warte auf Bezahlung und Bestätigung…
        </span>
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
    <motion.div
      className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <SuccessBurst />
      <motion.div
        className="w-full max-w-md text-center rounded-3xl border border-line bg-white p-10 shadow-xl"
        initial={{ opacity: 0, scale: 0.8, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 12 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <motion.div
          className="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-accent text-white text-3xl"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 14,
            delay: 0.1,
          }}
        >
          <motion.i
            className="fa-solid fa-check"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 12,
              delay: 0.22,
            }}
          />
        </motion.div>
        <motion.h2
          className="mt-6 text-3xl font-bold"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          Danke!
        </motion.h2>
        <motion.p
          className="mt-2 text-mute"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Ihre Bestellung ist raus.
        </motion.p>
        <motion.div
          className="mt-6 rounded-2xl border-2 border-accent bg-accent/5 py-5"
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 220,
            damping: 18,
            delay: 0.25,
          }}
        >
          <p className="text-xs font-bold text-accent uppercase tracking-widest">
            Ihre Nummer
          </p>
          <motion.p
            className="mt-1 text-5xl font-black text-accent tabular-nums"
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 14,
              delay: 0.35,
            }}
          >
            {orderNumber}
          </motion.p>
        </motion.div>
        <motion.p
          className="mt-4 text-4xl font-black tabular-nums"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {formatEuro(totalCents)}
        </motion.p>
        <motion.button
          onClick={onNewOrder}
          className="mt-8 w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          whileTap={{ scale: 0.97 }}
        >
          Neue Bestellung
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function AnimatedTile({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.05, 0.6),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
