"use client";

import { createPortal } from "react-dom";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { formatEuro } from "@/lib/format";
import {
  getVoucherDiscountAmountForConfig,
  getVoucherSavingsLabelForConfig,
} from "@/lib/shop";

type PurchaseButtonProps = {
  productId: string;
  label: string;
  disabled?: boolean;
  isDemoUser?: boolean;
  fixedAmountCents?: number;
  amountOptions?: number[];
  voucherDiscountType?: "FIXED" | "PERCENT" | null;
  voucherDiscountValue?: number;
  voucherNoticeText?: string | null;
  isVoucher?: boolean;
  giftCardCode?: string;
};

export function PurchaseButton({
  productId,
  label,
  disabled = false,
  isDemoUser = false,
  fixedAmountCents,
  amountOptions = [],
  voucherDiscountType,
  voucherDiscountValue,
  voucherNoticeText,
  isVoucher = false,
  giftCardCode,
}: PurchaseButtonProps) {
  const [selectedAmount, setSelectedAmount] = useState(amountOptions[0] ?? fixedAmountCents ?? 0);
  const [isOpen, setIsOpen] = useState(false);
  const [showVoucherNotice, setShowVoucherNotice] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const noticeLines = (voucherNoticeText ?? "").trim().split(/\n+/).filter(Boolean);
  const noticeCopy = noticeLines.length > 0 ? noticeLines : [
    "Bitte lies dir die Hinweise zum Gutschein vor dem Kauf durch.",
    "Mit dem Akzeptieren bestätigst du, dass du die Bedingungen gelesen hast.",
  ];

  function renderNoticeLine(line: string) {
    const urlPattern = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/g;
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlPattern.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
      const rawUrl = match[0];
      const href = rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
      parts.push(<a href={href} key={`${match.index}-${rawUrl}`} rel="noreferrer" target="_blank">{rawUrl}</a>);
      lastIndex = match.index + rawUrl.length;
    }

    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return parts.length > 0 ? parts : [line];
  }

  const hasSelectableAmount = amountOptions.length > 0;
  const discountType = voucherDiscountType ?? null;
  const discountValue = voucherDiscountValue ?? 0;

  const canPurchase = useMemo(() => {
    if (hasSelectableAmount) return selectedAmount > 0;
    return (fixedAmountCents ?? 0) > 0;
  }, [fixedAmountCents, hasSelectableAmount, selectedAmount]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!showVoucherNotice) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(event: KeyboardEvent) { if (event.key === "Escape") setShowVoucherNotice(false); }
    document.addEventListener("keydown", handleEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleEscape); };
  }, [showVoucherNotice]);

  async function handlePurchase() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          amountCents: hasSelectableAmount ? selectedAmount : fixedAmountCents,
          giftCardCode: giftCardCode || undefined,
        }),
      });

      const rawBody = await response.text();
      let data: { error?: string; paymentUrl?: string; paid?: boolean; message?: string; orderId?: string } = {};

      if (rawBody) {
        try { data = JSON.parse(rawBody) as typeof data; } catch { data = {}; }
      }

      if (!response.ok) {
        setMessage(data.error ?? "Checkout konnte nicht gestartet werden.");
        return;
      }

      if (data.paid) {
        setMessage(data.message ?? "Bezahlt!");
        return;
      }

      if (!data.paymentUrl) {
        setMessage("Checkout konnte nicht gestartet werden.");
        return;
      }

      window.location.href = data.paymentUrl;
    } finally {
      setLoading(false);
    }
  }

  async function handlePrimaryClick() {
    if (isDemoUser) {
      setMessage("Demo-Nutzer duerfen nicht bestellen.");
      return;
    }

    if (isVoucher) {
      setNoticeAccepted(false);
      setShowVoucherNotice(true);
      return;
    }

    await handlePurchase();
  }

  return (
    <div className="mt-6">
      {hasSelectableAmount && (
        <div className="mb-4" ref={dropdownRef}>
          <span className="block text-sm font-bold text-ink mb-1.5">Betrag wählen</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen((c) => !c)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-5 py-3 text-sm hover:border-accent transition-colors"
            >
              <span className="font-bold">{formatEuro(selectedAmount)}</span>
              <span className="text-mute text-xs">▾</span>
            </button>
            {isOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-line bg-white shadow-lg overflow-hidden">
                {amountOptions.map((amount) => {
                  const discountAmount = discountType ? getVoucherDiscountAmountForConfig(amount, discountType, discountValue) : 0;
                  const paymentAmount = Math.max(amount - discountAmount, 1);
                  const isSelected = selectedAmount === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => { setSelectedAmount(amount); setIsOpen(false); }}
                      className={`flex w-full items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-surf ${isSelected ? "bg-accent/5 font-bold" : ""}`}
                    >
                      <span>{formatEuro(amount)}</span>
                      <span className="text-accent font-bold">{formatEuro(paymentAmount)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {discountType && discountValue ? (
            <p className="mt-1.5 text-xs text-green-600">
              {getVoucherSavingsLabelForConfig(selectedAmount, discountType, discountValue) ?? ""}
            </p>
          ) : null}
        </div>
      )}

      <button
        onClick={() => void handlePrimaryClick()}
        disabled={disabled || loading || !canPurchase}
        className="flex w-full items-center justify-center rounded-xl bg-accent px-8 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        type="button"
      >
        {loading ? "Weiterleitung..." : label}
      </button>

      {message && <p className="mt-2 text-sm text-red-600">{message}</p>}

      {showVoucherNotice && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35" onClick={() => setShowVoucherNotice(false)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Gutschein-Hinweis</h3>
              <button onClick={() => setShowVoucherNotice(false)} className="text-mute hover:text-ink text-xl">&times;</button>
            </div>
            <div className="space-y-2 text-sm text-mute leading-relaxed">
              {noticeCopy.map((line, i) => <p key={i}>{renderNoticeLine(line)}</p>)}
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm font-medium">
              <input type="checkbox" checked={noticeAccepted} onChange={(e) => setNoticeAccepted(e.target.checked)} className="mt-0.5 accent-accent" />
              <span>Ich habe die Hinweise gelesen und akzeptiere sie.</span>
            </label>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowVoucherNotice(false)} className="flex-1 rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink hover:bg-surf transition-colors">Abbrechen</button>
              <button onClick={() => { setShowVoucherNotice(false); void handlePurchase(); }} disabled={loading || !noticeAccepted} className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50">Akzeptieren und bezahlen</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
