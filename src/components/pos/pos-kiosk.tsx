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
  POS_RBANK_CHECKOUT_MODE_KEY,
  parseRbankCheckoutMode,
  type PosPaymentMethod,
  type PosRbankCheckoutMode,
} from "@/lib/pos";
import { formatEuro } from "@/lib/format";
import { printReceipt } from "@/lib/pos-print-client";
import { LockScreen } from "@/components/pos/lock-screen";
import { SuccessBurst } from "@/components/kokonutui/success-burst";
import type { PosSettings } from "@/lib/pos-settings";
import { PosDebugMenu } from "@/components/pos/pos-debug-menu";
import type { PosTranslationKey } from "@/lib/pos-i18n";
import {
  PosLanguageProvider,
  PosLanguageSwitch,
  usePosLang,
} from "@/components/pos/pos-language";

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

const METHOD_META: Record<
  PosPaymentMethod,
  { titleKey: PosTranslationKey; subKey: PosTranslationKey; icon: string }
> = {
  RBANK: {
    titleKey: "methodRbankTitle",
    subKey: "methodRbankSub",
    icon: "fa-solid fa-mobile-screen",
  },
  TIPPIE: {
    titleKey: "methodTippieTitle",
    subKey: "methodTippieSub",
    icon: "fa-solid fa-credit-card",
  },
  TERMINAL: {
    titleKey: "methodTerminalTitle",
    subKey: "methodTerminalSub",
    icon: "fa-solid fa-id-card",
  },
  CASH: {
    titleKey: "methodCashTitle",
    subKey: "methodCashSub",
    icon: "fa-solid fa-money-bill-wave",
  },
  GUTSCHEIN: {
    titleKey: "methodGiftTitle",
    subKey: "methodGiftSub",
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

export type PosKioskProps = {
  vendorName: string;
  products: PosProduct[];
  toppings: PosProduct[];
  settings: PosSettings;
  demo?: boolean;
  rbankBaseUrl?: string;
};

export function PosKiosk(props: PosKioskProps) {
  return (
    <PosLanguageProvider>
      <PosKioskInner {...props} />
    </PosLanguageProvider>
  );
}

function PosKioskInner({
  vendorName,
  products,
  toppings,
  settings,
  demo = false,
  rbankBaseUrl,
}: PosKioskProps) {
  const { lang, t: tr } = usePosLang();
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [speakerOn, setSpeakerOn] = useState(() => !demo);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toppingOpen, setToppingOpen] = useState(false);
  const [toppingContainer, setToppingContainer] = useState<Container | null>(
    null,
  );
  const [pickerProduct, setPickerProduct] = useState<PosProduct | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [method, setMethod] = useState<PosPaymentMethod | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [rbankToken, setRbankToken] = useState<string | null>(null);
  const [rbankKey, setRbankKey] = useState<string | null>(null);
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
  const demoConfirmTimerRef = useRef<number | null>(null);
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const [debugOpen, setDebugOpen] = useState(false);
  const debugTimerRef = useRef<number | null>(null);
  const debugTapRef = useRef(0);
  const [rbankCheckoutMode, setRbankCheckoutMode] =
    useState<PosRbankCheckoutMode>(() => {
      if (typeof window === "undefined") return "embed";
      try {
        return parseRbankCheckoutMode(
          window.localStorage.getItem(POS_RBANK_CHECKOUT_MODE_KEY),
        );
      } catch {
        return "embed";
      }
    });

  function changeRbankCheckoutMode(mode: PosRbankCheckoutMode) {
    setRbankCheckoutMode(mode);
    try {
      window.localStorage.setItem(POS_RBANK_CHECKOUT_MODE_KEY, mode);
    } catch {
      /* Storage nicht verfügbar */
    }
  }

  useEffect(() => {
    return () => {
      if (demoConfirmTimerRef.current !== null) {
        window.clearTimeout(demoConfirmTimerRef.current);
      }
      if (debugTimerRef.current !== null) {
        window.clearTimeout(debugTimerRef.current);
      }
    };
  }, []);

  // SDK früh laden, damit der Checkout beim Klick sofort startet.
  useEffect(() => {
    if (demo || !rbankBaseUrl || rbankCheckoutMode !== "embed") return;
    loadRbankCheckoutSdk(rbankBaseUrl).catch(() => {});
  }, [demo, rbankBaseUrl, rbankCheckoutMode]);

  function handleLogoClick() {
    debugTapRef.current += 1;
    if (debugTimerRef.current !== null) window.clearTimeout(debugTimerRef.current);
    debugTimerRef.current = window.setTimeout(() => {
      debugTapRef.current = 0;
    }, 1800);
    if (debugTapRef.current >= 10) {
      debugTapRef.current = 0;
      setDebugOpen(true);
    }
  }

  useEffect(() => {
    if (!method && demoConfirmTimerRef.current !== null) {
      window.clearTimeout(demoConfirmTimerRef.current);
      demoConfirmTimerRef.current = null;
    }
  }, [method]);

  const containerMode = products.some((p) => p.isContainer);
  const containerProducts = products.filter((p) => p.isContainer);
  const scoopProducts = products.filter((p) => !p.isContainer);
  const toppingProducts = toppings;
  const activeContainer =
    wizardStep === "build" ? (containers[activeContainerIndex] ?? null) : null;

  useEffect(() => {
    if (demo) {
      setSpeechEnabled(false);
      return;
    }
    const stored = window.localStorage.getItem("fyndo-pos-speaker");
    if (stored !== null) {
      const on = stored === "1";
      setSpeakerOn(on);
      setSpeechEnabled(on);
    }
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    window.localStorage.setItem("fyndo-pos-speaker", speakerOn ? "1" : "0");
    setSpeechEnabled(speakerOn);
  }, [speakerOn, demo]);

  useEffect(() => {
    if (initialAnnounceRef.current) return;
    initialAnnounceRef.current = true;
    if (lockOpen) return;
    const timer = window.setTimeout(() => {
      if (containerMode) {
        announce(
          "welcome",
          tr("sayWelcomeContainers", { vendor: vendorName }),
          lang,
        );
      } else {
        announce("welcome", tr("sayWelcome", { vendor: vendorName }), lang);
      }
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorName, lockOpen, containerMode, lang]);

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
          tr("sayIdle"),
          lang,
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
    tr,
    lang,
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
      tr("sayAdded", {
        label,
        price: formatSpokenEuro(itemPrice(product, variant), lang),
      }),
      lang,
    );
  }

  function removeProduct(
    product: PosProduct,
    variant: PosVariant | null,
    container: Container | null = null,
  ) {
    setQty(product, variant, 0, container);
    const label = variant ? `${product.title} ${variant.name}` : product.title;
    announce("product-removed", tr("sayRemoved", { label }), lang);
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
    announce(
      "product-added",
      tr("sayContainerAdded", { label: product.title }),
      lang,
    );
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
    announce("product-removed", tr("sayRemoved", { label: product.title }), lang);
  }

  function enterBuildStep() {
    setWizardStep("build");
    setActiveContainerIndex(0);
    const first = containers[0];
    if (first)
      announce(
        "container",
        tr("sayContainerScoops", { label: first.label }),
        lang,
      );
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
    openToppingsForActiveContainer();
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
      tr("sayChooseVariant", { product: product.title }),
      lang,
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
    if (
      containerMode &&
      wizardStep === "build" &&
      containers[activeContainerIndex]
    ) {
      openToppingsForActiveContainer();
      return;
    }
    if (toppingProducts.length > 0) {
      setToppingContainer(null);
      setToppingOpen(true);
      announce("toppings", tr("sayToppings"), lang);
      return;
    }
    setSummaryOpen(true);
    announce("checkout", tr("sayCheckout"), lang);
  }

  function openToppingsForActiveContainer() {
    const c = containers[activeContainerIndex];
    if (!c) return;
    if (toppingProducts.length === 0) {
      advanceAfterToppings();
      return;
    }
    setToppingContainer(c);
    setToppingOpen(true);
    announce(
      "toppings",
      tr("sayToppingsContainer", { label: c.label }),
      lang,
    );
  }

  function advanceAfterToppings() {
    if (activeContainerIndex + 1 < containers.length) {
      const nextIndex = activeContainerIndex + 1;
      setActiveContainerIndex(nextIndex);
      const c = containers[nextIndex];
      if (c)
        announce(
          "container",
          tr("sayContainerScoops", { label: c.label }),
          lang,
        );
    } else {
      setSummaryOpen(true);
      announce("checkout", tr("sayCheckout"), lang);
    }
  }

  function applyToppings(
    selected: { product: PosProduct; variant: PosVariant | null; qty: number }[],
    container: Container | null,
  ) {
    const byKey = new Map(
      selected.map((s) => [
        s.variant ? `${s.product.id}:${s.variant.id}` : s.product.id,
        s,
      ]),
    );
    for (const topping of toppingProducts) {
      if (topping.variants.length === 0) {
        setQty(topping, null, byKey.get(topping.id)?.qty ?? 0, container);
      } else {
        for (const variant of topping.variants) {
          setQty(
            topping,
            variant,
            byKey.get(`${topping.id}:${variant.id}`)?.qty ?? 0,
            container,
          );
        }
      }
    }
    setToppingOpen(false);
    setToppingContainer(null);
    advanceAfterToppings();
  }

  function skipToppings(container: Container | null) {
    for (const topping of toppingProducts) {
      if (topping.variants.length === 0) {
        setQty(topping, null, 0, container);
      } else {
        for (const variant of topping.variants) {
          setQty(topping, variant, 0, container);
        }
      }
    }
    setToppingOpen(false);
    setToppingContainer(null);
    advanceAfterToppings();
  }

  function openPayment() {
    setSummaryOpen(false);
    setCheckoutOpen(true);
    announce("checkout", tr("sayAssigning"), lang);
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
      announce("new-order", tr("sayNewOrder"), lang);
    }
  }

  // Demo: bestellte Bestellungen in localStorage ablegen, damit sie auf dem
  // Demo-Board (/demos/pos-board) live auftauchen.
  function saveDemoPosOrder(info: OrderInfo, method: string | null) {
    if (typeof window === "undefined") return;
    try {
      const items = Array.from(cart.values()).map((i) => ({
        title: i.product.title,
        variantName: i.variant?.name ?? null,
        containerName: i.containerLabel,
        amountCents: itemPrice(i.product, i.variant),
        qty: i.qty,
      }));
      const entry = {
        posGroupId: info.posGroupId,
        posOrderNumber: info.posOrderNumber,
        totalCents: info.totalCents,
        quantity: cartCount,
        itemCount: items.length,
        method,
        status: "PAID",
        createdAt: new Date().toISOString(),
        fulfilledAt: null,
        items,
      };
      const key = "fyndo-demo-pos-orders";
      let list: unknown[] = [];
      try {
        list = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown[];
      } catch {
        list = [];
      }
      const filtered = list.filter(
        (e) => (e as { posGroupId?: string }).posGroupId !== info.posGroupId,
      );
      filtered.push(entry);
      window.localStorage.setItem(key, JSON.stringify(filtered.slice(-15)));
    } catch {
      // localStorage nicht verfügbar – ignorieren
    }
  }

  async function createOrder(): Promise<OrderInfo | null> {
    if (order) return order;
    if (cart.size === 0 || cartTotal <= 0) return null;
    setError("");
    setBusy(true);
    if (demo) {
      const info: OrderInfo = {
        posGroupId: `demo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        posConfirmToken: `demo-token-${Math.random().toString(36).slice(2, 10)}`,
        posOrderNumber: 100 + Math.floor(Math.random() * 9000),
        totalCents: cartTotal,
        itemCount: cartCount,
      };
      setOrder(info);
      announce(
        "order-sent",
        tr("sayOrderNumber", { number: info.posOrderNumber }),
        lang,
      );
      setBusy(false);
      return info;
    }
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
        setError(data.error ?? tr("orderStartError"));
        return null;
      }
      setOrder(data);
      announce(
        "order-sent",
        tr("sayOrderNumber", { number: data.posOrderNumber }),
        lang,
      );
      return data as OrderInfo;
    } catch {
      setError(tr("orderStartError"));
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
    setRbankToken(null);
    setRbankKey(null);
    setRbankStatus(null);
    if (m === "GUTSCHEIN") {
      setBusy(false);
      announce(
        "select-payment",
        tr("sayGiftCode"),
        lang,
      );
      return;
    }
    if (demo) {
      const currentOrder = orderInfo;
      const payTotal = currentOrder.totalCents - giftApplied;
      setBusy(false);
      saveDemoPosOrder(currentOrder, m);
      setPaymentUrl(
        m === "TIPPIE"
          ? `https://pay.tippie.de/business-pay/3763235/EUR/${Math.max(payTotal, 0)}`
          : null,
      );
      announceByMethod(m, payTotal, currentOrder.posOrderNumber);
      onConfirmed(currentOrder.totalCents - giftApplied, currentOrder.posOrderNumber);
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
        setError(data.error ?? tr("paymentStartFailed"));
        setMethod(null);
        setBusy(false);
        return;
      }
      setPaymentUrl(data.paymentUrl ?? null);
      setRbankToken(data.token ?? null);
      setRbankKey(data.embedKey ?? null);
      announceByMethod(m, payTotal, currentOrder.posOrderNumber);
    } catch {
      setError(tr("paymentStartFailed"));
      setMethod(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCash() {
    if (!order) return;
    setError("");
    setBusy(true);
    if (demo) {
      setBusy(false);
      saveDemoPosOrder(order, "CASH");
      onConfirmed(cartTotal, order.posOrderNumber);
      return;
    }
    try {
      const res = await fetch("/api/pos/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: order.posGroupId,
          posConfirmToken: order.posConfirmToken,
          method: "CASH",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? tr("confirmFailed"));
        return;
      }
      onConfirmed(cartTotal, order.posOrderNumber);
    } catch {
      setError(tr("confirmFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function applyGiftCard(code: string) {
    if (!order) return null;
    setError("");
    setBusy(true);
    if (demo) {
      setBusy(false);
      const remaining = Math.max(order.totalCents - giftApplied, 0);
      setGiftApplied((prev) => prev + remaining);
      return { deduction: remaining, remainder: 0 };
    }
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
        setError(data.error ?? tr("giftRedeemFailed"));
        return null;
      }
      setGiftApplied((prev) => prev + data.deduction);
      return { deduction: data.deduction, remainder: data.remainder };
    } catch {
      setError(tr("giftRedeemFailed"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmGiftCardFull() {
    if (!order) return;
    setError("");
    setBusy(true);
    if (demo) {
      setBusy(false);
      saveDemoPosOrder(order, "GUTSCHEIN");
      onConfirmed(cartTotal, order.posOrderNumber);
      return;
    }
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
        setError(data.error ?? tr("confirmFailed"));
        return;
      }
      onConfirmed(cartTotal, order.posOrderNumber);
    } catch {
      setError(tr("confirmFailed"));
    } finally {
      setBusy(false);
    }
  }

  function announceByMethod(
    m: PosPaymentMethod,
    totalCents: number,
    orderNumber: number,
  ) {
    const total = formatSpokenEuro(totalCents, lang);
    if (m === "RBANK")
      announce(
        "rbank-qr",
        rbankCheckoutMode === "qr"
          ? tr("sayRbankQr", { number: orderNumber })
          : tr("sayRbankEmbed", { number: orderNumber }),
        lang,
      );
    else if (m === "TIPPIE")
      announce(
        "tippie-qr",
        tr("sayTippie", { amount: total, number: orderNumber }),
        lang,
      );
    else if (m === "TERMINAL")
      announce("terminal-call", tr("sayTerminal"), lang);
    else if (m === "CASH")
      announce(
        "cash",
        tr("sayCash", { amount: total, number: orderNumber }),
        lang,
      );
    else if (m === "GUTSCHEIN")
      announce(
        "select-payment",
        tr("sayGiftNumber", { number: orderNumber }),
        lang,
      );
  }

  function printOrderReceipt(totalCents: number, orderNumber: number) {
    if (demo) return;
    const groupId = order?.posGroupId ?? `num-${orderNumber}`;
    if (printedOrdersRef.current.has(groupId)) return;
    printedOrdersRef.current.add(groupId);

    const items = Array.from(cart.values()).map((item) => {
      const label = item.containerLabel
        ? `${item.containerLabel} · ${itemLabel(item)}`
        : itemLabel(item);
      return {
        qty: item.qty,
        name: label,
        amountCents: itemPrice(item.product, item.variant) * item.qty,
      };
    });

    void printReceipt({
      vendorName,
      orderNumber,
      date: new Date().toISOString(),
      items,
      subtotalCents: cartTotal,
      totalCents,
      giftCardCents: Math.max(0, cartTotal - totalCents),
      paymentMethod: method ?? undefined,
      footer: "Vielen Dank für Ihren Einkauf!",
    }).catch(() => {});
  }

  function onConfirmed(totalCents: number, orderNumber: number) {
    setDone({ totalCents, orderNumber });
    announce(
      "payment-confirmed",
      tr("sayConfirmed", { number: orderNumber }),
      lang,
    );
    printOrderReceipt(totalCents, orderNumber);
  }

  useEffect(() => {
    if (demo) return;
    if (!checkoutOpen || !order || done !== null) return;
    const current = order;
    let cancelled = false;
    const startedAt = Date.now();
    const MAX_POLL_MS = 5 * 60 * 1000;
    let inFlight = false;
    async function poll() {
      if (cancelled || inFlight) return;
      // Verwaister Checkout (Kunde geht weg): nach 5 Min. nicht mehr pollen,
      // sonst läuft der 2s-Takt ewig weiter und verbrennt Function-CPU + DB.
      if (Date.now() - startedAt > MAX_POLL_MS) {
        cancelled = true;
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      inFlight = true;
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
      } finally {
        inFlight = false;
      }
    }
    void poll();
    const interval = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen, order, done, method, demo]);

  async function cancelPendingOrder() {
    if (!order) return;
    const current = order;
    if (!demo) {
      await fetch("/api/pos/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posGroupId: current.posGroupId,
          posConfirmToken: current.posConfirmToken,
        }),
      }).catch(() => {});
    }
    setOrder((prev) => (prev?.posGroupId === current.posGroupId ? null : prev));
  }

  function closeCheckout() {
    clearAnnouncements();
    if (demoConfirmTimerRef.current !== null) {
      window.clearTimeout(demoConfirmTimerRef.current);
      demoConfirmTimerRef.current = null;
    }
    setCheckoutOpen(false);
    setSummaryOpen(false);
    setOrder(null);
    setMethod(null);
    setPaymentUrl(null);
    setRbankToken(null);
    setRbankKey(null);
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
        ? tr("sayWelcomeContainers", { vendor: vendorName })
        : tr("sayWelcome", { vendor: vendorName }),
      lang,
    );
  }

  function resetForNext() {
    if (settings.lockScreenEnabled) {
      lockAfterOrder();
    } else {
      announce("new-order", tr("sayNewOrder"), lang);
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
            <button
              type="button"
              onClick={handleLogoClick}
              className="block max-w-full text-left select-none"
              aria-label={settings.adminEnabled ? tr("settings") : vendorName}
            >
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                {vendorName}
                <span className="text-accent">.</span>
              </h1>
            </button>
            <p className="text-xs text-mute -mt-0.5">{tr("tagline")}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <PosLanguageSwitch />
            {!demo && (
              <button
                onClick={() => setSpeakerOn((s) => !s)}
                className={`w-11 h-11 rounded-full border flex items-center justify-center text-lg transition-colors ${speakerOn ? "border-accent text-accent" : "border-line text-mute"}`}
                aria-label={speakerOn ? tr("soundOff") : tr("soundOn")}
              >
                <i
                  className={`${speakerOn ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark"}`}
                />
              </button>
            )}
            <button
              onClick={resetForNewCustomer}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${cartCount > 0 ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "border-red-100 text-red-400 hover:bg-red-50"}`}
              aria-label={tr("clearAll")}
            >
              <i className="fa-solid fa-user-plus" />
              <span className="hidden sm:inline">{tr("clearAll")}</span>
            </button>
            <button
              onClick={() => {
                setCartOpen(true);
                announce("cart", tr("cartOpened"), lang);
              }}
              className="relative flex items-center gap-3 rounded-full border border-line bg-white pl-3 pr-4 py-2 hover:border-accent hover:bg-surf transition-colors"
            >
              <i className="fa-solid fa-basket-shopping text-accent text-lg" />
              <div className="text-right">
                <div className="text-sm sm:text-base font-black text-accent tabular-nums leading-none">
                  {formatEuro(cartTotal)}
                </div>
                <div className="text-[11px] text-mute leading-tight mt-0.5">
                  {tr("articles", { count: cartCount })}
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
            {tr("noProducts")}
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
                  ? tr("chooseContainerCta")
                  : tr("nextScoops")}
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
                  ? tr("extrasAndPay")
                  : tr("nextExtras", {
                      label: containers[activeContainerIndex + 1]?.label ?? "",
                    })}
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
                  ? tr("emptyCartShort")
                  : tr("payNow")}
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
            containerLabel={toppingContainer?.label ?? null}
            currentQty={(productId, variantId) => {
              const topping = toppingProducts.find((t) => t.id === productId);
              if (!topping) return 0;
              const variant = variantId
                ? (topping.variants.find((v) => v.id === variantId) ?? null)
                : null;
              return (
                cart.get(
                  cartKey(topping, variant, toppingContainer?.key ?? null),
                )?.qty ?? 0
              );
            }}
            onBack={() => {
              clearAnnouncements();
              setToppingOpen(false);
              setToppingContainer(null);
            }}
            onSkip={() => skipToppings(toppingContainer)}
            onConfirm={(selected) => applyToppings(selected, toppingContainer)}
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
            rbankToken={rbankToken}
            rbankKey={rbankKey}
            rbankBaseUrl={rbankBaseUrl}
            rbankCheckoutMode={rbankCheckoutMode}
            busy={busy}
            error={error}
            rbankStatus={rbankStatus}
            onRbankStatus={setRbankStatus}
            onSelectMethod={(m) => void selectMethod(m)}
            onApplyGiftCard={(code) => applyGiftCard(code)}
            onConfirmGiftCardFull={() => void confirmGiftCardFull()}
            onConfirmCash={() => void confirmCash()}
            onRetry={() => void createOrder()}
            onBack={
              method
                ? () => {
                    clearAnnouncements();
                    setMethod(null);
                    setPaymentUrl(null);
                    setRbankToken(null);
                    setRbankKey(null);
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

      {debugOpen && (
        <PosDebugMenu
          vendorName={vendorName}
          adminEnabled={settings.adminEnabled && settings.adminCodeHash !== ""}
          rbankCheckoutMode={rbankCheckoutMode}
          onRbankCheckoutModeChange={changeRbankCheckoutMode}
          onClose={() => setDebugOpen(false)}
        />
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
  const { t } = usePosLang();
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
            ? t("fromPrice", { price: formatEuro(minPrice) })
            : formatEuro(product.price)}
        </p>
        {hasVariants && (
          <span className="mt-1 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">
            {t("variants", { count: product.variants.length })}
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
            aria-label={t("qtyDecrease")}
          >
            −
          </button>
          <span className="text-sm font-black text-accent tabular-nums">
            {qty}
          </span>
          <button
            onClick={() => onSetQty(qty + 1)}
            className="w-9 h-9 rounded-lg bg-white text-accent font-black flex items-center justify-center shadow-sm hover:bg-accent hover:text-white transition-colors"
            aria-label={t("qtyIncrease")}
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
  const { t } = usePosLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
        {t("chooseContainers")}
      </h2>
      <p className="text-sm text-mute mb-6">{t("chooseContainersHint")}</p>
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
            {t("chosen")}
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
  const { t } = usePosLang();
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
          aria-label={t("back")}
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
                  <span className="text-xs font-bold opacity-80">
                    · {t("active")}
                  </span>
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
        {isLast ? t("buildHintLast") : t("buildHint")}
      </p>

      {scoopProducts.length === 0 ? (
        <div className="text-center py-16 text-mute">{t("noScoops")}</div>
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
  const { t } = usePosLang();
  return (
    <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 sm:p-10 text-center shadow-2xl">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-accent text-accent text-5xl font-black tabular-nums">
          {Math.max(seconds, 0)}
        </div>
        <h2 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight">
          {t("idleTitle")}
        </h2>
        <p className="mt-2 text-sm text-mute">{t("idleHint")}</p>
        <button
          onClick={onStay}
          className="mt-8 w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
        >
          {t("idleStay")}
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
  const { t } = usePosLang();
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
            <p className="text-xs text-mute">{t("chooseVariant")}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label={t("close")}
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
  containerLabel,
  currentQty,
  onBack,
  onSkip,
  onConfirm,
}: {
  toppings: PosProduct[];
  containerLabel: string | null;
  currentQty: (productId: string, variantId: string | null) => number;
  onBack: () => void;
  onSkip: () => void;
  onConfirm: (
    selected: { product: PosProduct; variant: PosVariant | null; qty: number }[],
  ) => void;
}) {
  const { t } = usePosLang();
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
              {t("extras")}
              {containerLabel ? ` · ${containerLabel}` : ""}
            </p>
            <h2 className="text-xl font-bold truncate">
              {activeTopping ? activeTopping.title : t("toppingsTitle")}
            </h2>
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label={t("close")}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 p-6">
          {activeTopping ? (
            <div className="space-y-3">
              <p className="text-sm text-mute">{t("toppingsVariantHint")}</p>
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
                          aria-label={t("qtyDecreaseNamed", {
                            name: variant.name,
                          })}
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
                {t("backToExtras")}
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
                          ? t("fromPrice", { price: formatEuro(minPrice) })
                          : formatEuro(topping.price)}
                      </p>
                      {hasVariants && (
                        <span className="mt-1 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                          {t("variants", { count: topping.variants.length })}
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
                          aria-label={t("qtyDecrease")}
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
                          aria-label={t("qtyIncrease")}
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
                ? t("extrasSelected", { count: selectedCount })
                : t("noExtrasSelected")}
            </span>
            <span className="text-2xl font-black tabular-nums">
              {formatEuro(selectedTotal)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={onSkip}
              className="w-full rounded-full border border-line px-8 py-4 text-base font-bold text-ink transition-colors hover:bg-surf active:scale-[0.99]"
            >
              <i className="fa-solid fa-xmark mr-2" />
              {t("noThanks")}
            </button>
            <button
              onClick={() => onConfirm(buildSelection())}
              disabled={selectedCount === 0}
              className={`w-full rounded-full px-8 py-4 text-base font-bold transition-all active:scale-[0.99] ${
                selectedCount > 0
                  ? "bg-accent text-white hover:bg-accent-hover shadow-lg"
                  : "bg-tile text-mute cursor-not-allowed"
              }`}
            >
              <i className="fa-solid fa-check mr-2" />
              {t("continueWithToppings")}
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
  const { t } = usePosLang();
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
              {t("orderOverview")}
            </p>
            <h2 className="text-xl font-bold">{t("pleaseReview")}</h2>
            {itemCount > 0 && (
              <p className="text-xs text-mute mt-0.5 tabular-nums">
                {t("articles", { count: itemCount })}
              </p>
            )}
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label={t("continueOrdering")}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-tile flex items-center justify-center text-mute text-2xl">
              <i className="fa-solid fa-basket-shopping" />
            </div>
            <p className="font-bold">{t("cartEmptyTitle")}</p>
            <p className="text-sm text-mute max-w-xs">{t("cartEmptyHint")}</p>
            <button
              onClick={onBack}
              className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-accent-hover"
            >
              {t("continueOrdering")}
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
                                {t("extraBadge")}
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
              <span className="font-medium text-mute">{t("total")}</span>
              <span className="text-3xl font-black tabular-nums leading-none">
                {formatEuro(totalCents)}
              </span>
            </div>
            <button
              onClick={onPay}
              className="w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
            >
              {t("goToPayment")}
            </button>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={onBack}
                className="text-sm font-bold text-mute hover:text-ink transition-colors"
              >
                <i className="fa-solid fa-arrow-left mr-1.5" />
                {t("continueOrdering")}
              </button>
              <button
                onClick={onNewCustomer}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
              >
                <i className="fa-solid fa-rotate-left mr-1.5" />
                {t("clearAllLower")}
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
  const { t } = usePosLang();
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
          <h2 className="text-xl font-bold">{t("yourCart")}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label={t("close")}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16 text-mute">
              {t("cartEmpty")}
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
                          aria-label={t("qtyDecrease")}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-black tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => onSetQty(item, item.qty + 1)}
                          className="w-8 h-8 rounded-lg border border-line text-ink font-black flex items-center justify-center hover:bg-surf transition-colors"
                          aria-label={t("qtyIncrease")}
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
                          {t("remove")}
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
            <span className="text-mute font-medium">{t("total")}</span>
            <span className="text-3xl font-black tabular-nums">
              {formatEuro(totalCents)}
            </span>
          </div>
          <button
            onClick={onCheckout}
            disabled={items.length === 0 || totalCents <= 0}
            className="w-full rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99] disabled:bg-tile disabled:text-mute"
          >
            {t("payNow")}
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
  rbankToken,
  rbankKey,
  rbankBaseUrl,
  rbankCheckoutMode,
  busy,
  error,
  rbankStatus,
  onRbankStatus,
  onSelectMethod,
  onApplyGiftCard,
  onConfirmGiftCardFull,
  onConfirmCash,
  onRetry,
  onBack,
}: {
  vendorName: string;
  order: OrderInfo | null;
  totalCents: number;
  giftApplied: number;
  method: PosPaymentMethod | null;
  paymentUrl: string | null;
  rbankToken: string | null;
  rbankKey: string | null;
  rbankBaseUrl?: string;
  rbankCheckoutMode: PosRbankCheckoutMode;
  busy: boolean;
  error: string;
  rbankStatus: string | null;
  onRbankStatus: (status: string | null) => void;
  onSelectMethod: (m: PosPaymentMethod) => void;
  onApplyGiftCard: (code: string) => Promise<{ deduction: number; remainder: number } | null>;
  onConfirmGiftCardFull: () => void;
  onConfirmCash: () => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { t } = usePosLang();
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
                ? ` · ${t("orderNumber", { number: displayNumber })}`
                : ""}
            </p>
            <h2 className="text-xl font-bold">{t("payment")}</h2>
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-mute hover:bg-surf transition-colors"
            aria-label={t("back")}
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
                  {t("yourNumber")}
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
                        {t("assigningNumber")}
                      </p>
                    </>
                  ) : error ? (
                    <>
                      <i className="fa-solid fa-triangle-exclamation text-4xl text-red-400" />
                      <p className="mt-4 text-sm text-mute max-w-sm">
                        {t("orderStartFailed")}
                      </p>
                      <button
                        onClick={onRetry}
                        className="mt-6 rounded-full bg-accent px-8 py-3.5 text-base font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99]"
                      >
                        {t("retry")}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                      <p className="mt-5 text-sm font-bold text-mute">
                        {t("assigningNumber")}
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
                    const meta = METHOD_META[m];
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
                          <span className="block font-bold">
                            {t(meta.titleKey)}
                          </span>
                          <span className="block text-xs text-mute mt-0.5">
                            {belowMin
                              ? t("minAmount", {
                                  amount: formatEuro(
                                    POS_MIN_DIGITAL_PAYMENT_CENTS,
                                  ),
                                })
                              : t(meta.subKey)}
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
                  rbankToken={rbankToken}
                  rbankKey={rbankKey}
                  rbankBaseUrl={rbankBaseUrl}
                  rbankCheckoutMode={rbankCheckoutMode}
                  rbankStatus={rbankStatus}
                  onRbankStatus={onRbankStatus}
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
                <CashView
                  totalCents={totalCents}
                  busy={busy}
                  error={error}
                  onConfirm={onConfirmCash}
                />
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
  const { t } = usePosLang();
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
      setLocalError(t("giftCodeRequired"));
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
              <p className="mt-3 font-bold">{t("giftRedeemed")}</p>
              <p className="mt-1 text-sm text-mute">
                {t("giftDeducted", {
                  amount: formatEuro(result.deduction),
                })}
              </p>
              <div className="mt-4 w-full flex items-center justify-between rounded-xl bg-white border border-line px-4 py-3">
                <span className="text-sm font-medium text-mute">
                  {t("remainingAmount")}
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
                {busy ? t("confirming") : t("completeOrder")}
              </button>
            ) : (
              <>
                <p className="mt-5 text-xs font-bold text-mute uppercase tracking-widest">
                  {t("payRemainingWith")}
                </p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {remainderMethods.map((m) => {
                    const meta = METHOD_META[m];
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
                            {t(meta.titleKey)}
                          </span>
                          <span className="block text-[11px] text-mute truncate">
                            {t(meta.subKey)}
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
                  {t("redeemAnother")}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 text-accent text-2xl">
              <i className="fa-solid fa-gift" />
            </div>
            <p className="mt-3 font-bold">{t("enterGiftCode")}</p>
            <p className="mt-1 text-sm text-mute">
              {giftApplied > 0
                ? t("giftAlreadyApplied", { amount: formatEuro(giftApplied) })
                : t("giftCovers", { amount: formatEuro(totalCents) })}
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
                {busy ? t("checking") : t("redeem")}
              </button>
            </form>
          </>
        )}
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">{t("giftHint")}</p>
      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

type RBankCheckoutInstance = { start: () => void; unmount: () => void };

type RBankCheckoutSdk = {
  mount: (options: {
    token: string;
    key?: string;
    container: HTMLElement | string;
    baseUrl?: string;
    lazy?: boolean;
    height?: number;
    onReady?: () => void;
    onHeight?: (px: number) => void;
    onStatus?: (status: string) => void;
    onSuccess?: (result: { redirectUrl: string }) => void;
  }) => RBankCheckoutInstance;
};

declare global {
  interface Window {
    RBankCheckout?: RBankCheckoutSdk;
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadRbankCheckoutSdk(baseUrl: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Kein Browser-Kontext."));
  }
  if (window.RBankCheckout) return Promise.resolve();
  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${baseUrl.replace(/\/+$/, "")}/rbank-checkout.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        sdkLoadPromise = null;
        reject(new Error("RBank-Checkout-SDK konnte nicht geladen werden."));
      };
      document.head.appendChild(script);
    });
  }
  return sdkLoadPromise;
}

function RbankEmbedCheckout({
  token,
  embedKey,
  baseUrl,
  onStatus,
}: {
  token: string;
  embedKey: string;
  baseUrl: string;
  onStatus?: (status: string) => void;
}) {
  const { t } = usePosLang();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<RBankCheckoutInstance | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let disposed = false;
    setLoadFailed(false);
    loadRbankCheckoutSdk(baseUrl)
      .then(() => {
        if (disposed || !containerRef.current || !window.RBankCheckout) return;
        const instance = window.RBankCheckout.mount({
          token,
          key: embedKey,
          container: containerRef.current,
          baseUrl,
          lazy: false,
          height: 520,
          onStatus: (status) => {
            if (!disposed) onStatus?.(status);
          },
        });
        instanceRef.current = instance;
        // Das SDK setzt loading="lazy" – im POS sofort laden.
        const iframe = containerRef.current.querySelector("iframe");
        if (iframe) iframe.loading = "eager";
      })
      .catch(() => {
        if (!disposed) setLoadFailed(true);
      });
    return () => {
      disposed = true;
      instanceRef.current?.unmount();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, embedKey, baseUrl, retryNonce]);

  return (
    <div className="relative min-h-[520px]">
      {/* Spinner liegt hinter dem iframe – sobald die Embed-Seite irgendetwas
          malt, ist sie sichtbar, ohne auf load/ready zu warten. */}
      {loadFailed ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white text-mute">
          <span className="text-sm font-medium">{t("checkoutLoadFailed")}</span>
          <button
            onClick={() => setRetryNonce((n) => n + 1)}
            className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition-all hover:bg-accent-hover"
          >
            {t("retry")}
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-white text-mute">
          <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold">{t("loadingCheckout")}</span>
        </div>
      )}
      <div ref={containerRef} className="relative z-10 w-full" />
    </div>
  );
}

function PaymentQrView({
  method,
  paymentUrl,
  rbankToken,
  rbankKey,
  rbankBaseUrl,
  rbankCheckoutMode,
  rbankStatus,
  onRbankStatus,
}: {
  method: "RBANK" | "TIPPIE";
  paymentUrl: string | null;
  rbankToken: string | null;
  rbankKey: string | null;
  rbankBaseUrl?: string;
  rbankCheckoutMode: PosRbankCheckoutMode;
  rbankStatus: string | null;
  onRbankStatus: (status: string | null) => void;
}) {
  const { t } = usePosLang();
  if (method === "RBANK" && rbankCheckoutMode === "embed") {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-full max-w-xl min-h-[520px] rounded-2xl border border-line bg-white overflow-hidden">
          {rbankToken && rbankKey && rbankBaseUrl ? (
            <RbankEmbedCheckout
              token={rbankToken}
              embedKey={rbankKey}
              baseUrl={rbankBaseUrl}
              onStatus={onRbankStatus}
            />
          ) : (
            <div className="h-[520px] flex flex-col items-center justify-center gap-3 text-mute">
              <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold">{t("loadingCheckout")}</span>
            </div>
          )}
        </div>
        <p className="mt-5 text-sm text-mute max-w-sm">{t("rbankEmbedHint")}</p>
        {rbankStatus && rbankStatus !== "PENDING" && (
          <p className="mt-2 text-xs font-bold text-mute uppercase tracking-wide">
            {rbankStatus}
          </p>
        )}
        <div className="mt-6 flex items-center gap-3 text-mute">
          <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">{t("waitingPayment")}</span>
        </div>
      </div>
    );
  }

  const isRbankQr = method === "RBANK";

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border border-line bg-white p-3 flex items-center justify-center">
        {paymentUrl ? (
          <QrImage url={paymentUrl} />
        ) : (
          <div className="flex flex-col items-center gap-3 text-mute">
            <div className="h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">{t("loadingQr")}</span>
          </div>
        )}
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">
        {isRbankQr ? t("rbankQrHint") : t("tippieQrHint")}
      </p>
      {isRbankQr && rbankStatus && rbankStatus !== "PENDING" && (
        <p className="mt-2 text-xs font-bold text-mute uppercase tracking-wide">
          {rbankStatus}
        </p>
      )}
      <div className="mt-6 flex items-center gap-3 text-mute">
        <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">
          {t("waitingConfirmation")}
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
  const { t } = usePosLang();
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
        <span className="mt-3 text-sm font-bold">{t("terminalCalled")}</span>
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">{t("terminalHint")}</p>
      <div className="mt-6 flex items-center gap-3 text-mute">
        <div className="h-5 w-5 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">
          {t("waitingConfirmation")}
        </span>
      </div>
    </div>
  );
}

function CashView({
  totalCents,
  busy,
  error,
  onConfirm,
}: {
  totalCents: number;
  busy: boolean;
  error: string;
  onConfirm: () => void;
}) {
  const { t } = usePosLang();
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mt-2 w-48 h-48 rounded-3xl border border-line bg-surf flex flex-col items-center justify-center">
        <i className="fa-solid fa-money-bill-wave text-6xl text-accent" />
        <span className="mt-3 text-3xl font-black tabular-nums">
          {formatEuro(totalCents)}
        </span>
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">{t("cashHint")}</p>
      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      <button
        onClick={onConfirm}
        disabled={busy}
        className="mt-6 w-full max-w-sm rounded-full bg-accent px-8 py-4 text-base font-bold text-white transition-all hover:bg-accent-hover active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? t("sending") : t("payAtPickup")}
      </button>
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
  const { t } = usePosLang();
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
          {t("thanks")}
        </motion.h2>
        <motion.p
          className="mt-2 text-mute"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {t("orderPlaced")}
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
            {t("yourNumber")}
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
          {t("newOrder")}
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
