import { NextResponse } from "next/server";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Kurzzeit-Cache pro User+Scope, damit mehrere offene Tabs/Displays auf
// derselben Fluid-Instanz nicht je eine volle DB-Abfrage auslösen.
const CACHE_TTL_MS = 5000;
type GroupsCacheEntry = { expires: number; version: string; body: string };
const globalForGroupsCache = globalThis as unknown & {
  __posGroupsCache?: Map<string, GroupsCacheEntry>;
};
function getGroupsCache() {
  if (!globalForGroupsCache.__posGroupsCache) {
    globalForGroupsCache.__posGroupsCache = new Map();
  }
  return globalForGroupsCache.__posGroupsCache;
}

const SCOPE_STATUS: Record<string, ("PENDING" | "PAID" | "DONE" | "CANCELLED")[]> = {
  // legacy: unverändert lassen (falls extern referenziert)
  open: ["PENDING", "DONE"],
  paid: ["PAID", "DONE"],
  // neu, sparsam: nur das, was die jeweilige Ansicht wirklich anzeigt
  active: ["PENDING", "PAID"],
  board: ["PAID", "DONE"],
};

export async function GET(request: Request) {
  let user;
  try {
    user = await requireSellerOrSuperAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 });
    }
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 401 });
  }
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "open";
  const sinceRaw = url.searchParams.get("since");
  let sinceDate: Date | null = null;
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (!Number.isNaN(parsed.getTime())) sinceDate = parsed;
  }

  const statuses = SCOPE_STATUS[scope];
  const statusFilter = statuses ? { status: { in: statuses } } : {};
  const take = scope === "all" ? 200 : 100;

  const where = {
    posGroupId: { not: null },
    ...(isSuperAdmin ? {} : { product: { sellerId: user.id } }),
    ...statusFilter,
  };

  const cache = getGroupsCache();
  const cacheKey = `${user.id}:${scope}`;
  const nowMs = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > nowMs) {
    // Frischer Cache: ohne DB antworten. "since" deckt den Normalfall ab
    // (nichts hat sich geändert -> 304).
    if (sinceRaw && sinceRaw >= cached.version) {
      return new NextResponse(null, {
        status: 304,
        headers: { "x-pos-version": cached.version },
      });
    }
    if (!sinceDate) {
      return new NextResponse(cached.body, {
        headers: {
          "Content-Type": "application/json",
          "x-pos-version": cached.version,
          "Cache-Control": "private, no-store",
        },
      });
    }
    // Mit "since", das älter als der Cache ist: unten per DB prüfen, ob sich
    // seit "since" wirklich etwas geändert hat (billige findFirst statt 200er-Join).
  }

  // Billiger Change-Check: nur 1 Zeile statt 200 + Product-Join + Gruppierung.
  // Der Client sendet nach dem ersten Voll-Load ?since=<x-pos-version>.
  // Solange nichts geändert wurde, kostet der Poll nur diese eine Abfrage
  // und es gibt 304 ohne Body zurück.
  if (sinceDate) {
    const latest = await prisma.order.findFirst({
      where: { ...where, updatedAt: { gt: sinceDate } },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!latest) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "x-pos-version": sinceRaw as string,
          "Cache-Control": "private, no-store",
        },
      });
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      product: { select: { title: true, price: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const groups = new Map<string, (typeof orders)[number][]>();
  for (const order of orders) {
    const key = order.posGroupId!;
    const list = groups.get(key) ?? [];
    list.push(order);
    groups.set(key, list);
  }

  const result = Array.from(groups.entries())
    .map(([posGroupId, groupOrders]) => {
      const sorted = [...groupOrders].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      const totalCents = sorted.reduce((s, o) => s + o.amountCents, 0);
      const status = sorted.some((o) => o.status === "PENDING")
        ? "PENDING"
        : sorted.some((o) => o.status === "CANCELLED")
          ? "CANCELLED"
          : sorted.some((o) => o.status === "DONE")
            ? "DONE"
            : "PAID";
      const fulfilledAt = sorted.reduce<Date | null>((acc, o) => {
        if (!o.fulfilledAt) return acc;
        return !acc || o.fulfilledAt > acc ? o.fulfilledAt : acc;
      }, null);

      return {
        posGroupId,
        posConfirmToken: first.posConfirmToken,
        posOrderNumber: first.posOrderNumber ?? null,
        method: latest.paymentMethod ?? first.paymentMethod ?? null,
        status,
        totalCents,
        itemCount: sorted.length,
        quantity: sorted.reduce((s, o) => s + (o.quantity || 1), 0),
        createdAt: first.createdAt.toISOString(),
        fulfilledAt: fulfilledAt?.toISOString() ?? null,
        items: sorted.map((o) => ({
          title: o.product.title,
          variantName: o.variantName ?? null,
          containerId: o.posContainerId ?? null,
          containerName: o.posContainerName ?? null,
          amountCents: o.amountCents,
          qty: o.quantity || Math.max(Math.round(o.amountCents / (o.product.price || 1)), 1),
        })),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Version = neueste Änderung im Ergebnis; der Client nutzt sie als ?since=.
  let version = sinceRaw ?? new Date(0).toISOString();
  for (const o of orders) {
    const iso = o.updatedAt.toISOString();
    if (iso > version) version = iso;
  }
  if (orders.length === 0 && !sinceRaw) version = new Date().toISOString();

  const body = JSON.stringify(result);
  cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, version, body });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "x-pos-version": version,
      "Cache-Control": "private, no-store",
    },
  });
}
