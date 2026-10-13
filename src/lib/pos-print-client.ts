"use client";

/**
 * Client-Helfer für den fyndo Bon-Druckserver.
 *
 * Der Browser (Tablet) ruft den Druckserver direkt auf. Die Adresse kommt aus
 * dem localStorage (im POS-Debug-Menü einstellbar), sonst aus
 * NEXT_PUBLIC_POS_PRINT_URL, sonst `http://localhost:8787`.
 *
 * Für ein Tablet, das den Druckserver auf einem anderen Rechner erreicht, im
 * Debug-Menü die lokale IP eintragen, z. B. `http://192.168.1.50:8787`.
 */

const STORAGE_KEY = "fyndo-pos-print-url";
const DEFAULT_URL = "http://localhost:8787";

export type ReceiptItem = {
  qty: number;
  name: string;
  amountCents: number;
};

export type ReceiptPayload = {
  vendorName: string;
  orderNumber: number | string;
  date?: string;
  items: ReceiptItem[];
  subtotalCents: number;
  totalCents: number;
  giftCardCents?: number;
  paymentMethod?: string;
  header?: string;
  footer?: string;
  copies?: number;
  test?: boolean;
};

/** Druckserver-Adresse (localStorage → Env → Standard). */
export function getPrintServerUrl(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored.replace(/\/+$/, "");
  }
  const env = (process.env.NEXT_PUBLIC_POS_PRINT_URL ?? "").replace(/\/+$/, "");
  return env || DEFAULT_URL;
}

/** Druckserver-Adresse setzen (leer = Standard wiederherstellen). */
export function setPrintServerUrl(url: string) {
  if (typeof window === "undefined") return;
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
  else window.localStorage.removeItem(STORAGE_KEY);
}

async function postJson(path: string, body: unknown, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok || data.ok === false) {
      return { ok: false as const, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true as const, error: "" };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Zeitüberschreitung"
        : String((error as Error)?.message ?? error);
    return { ok: false as const, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Druckt einen Bon. Fehler werden abgefangen, damit der Bezahlvorgang im POS
 * niemals blockiert wird.
 */
export async function printReceipt(
  payload: ReceiptPayload,
): Promise<{ ok: boolean; error: string }> {
  return postJson(`${getPrintServerUrl()}/print`, payload);
}

/** Druckt einen Testbon über die konfigurierte Verbindung. */
export async function printTestReceipt(
  vendorName: string,
): Promise<{ ok: boolean; error: string }> {
  return postJson(`${getPrintServerUrl()}/test`, { vendorName });
}

/** Kurzer Erreichbarkeits-Check des Druckservers (druckt nichts). */
export async function checkPrintServer(): Promise<{ ok: boolean; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${getPrintServerUrl()}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, error: "" };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Zeitüberschreitung"
        : String((error as Error)?.message ?? error);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
