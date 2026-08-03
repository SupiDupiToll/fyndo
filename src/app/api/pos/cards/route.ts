import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function resolveSellerId(user: { id: string; role: string }, vendor?: string) {
  if (user.role === "SUPER_ADMIN" && vendor) {
    const found = await prisma.user.findFirst({
      where: { OR: [{ sellerName: vendor }, { displayName: vendor }] },
      select: { id: true },
    });
    if (!found) return null;
    return found.id;
  }
  return user.id;
}

export async function POST(request: NextRequest) {
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

  let body: { vendor?: string; count?: number; start?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabedaten." }, { status: 400 });
  }

  const vendor = String(body.vendor ?? "").trim();
  const sellerId = await resolveSellerId(user, vendor || undefined);
  if (!sellerId) {
    return NextResponse.json({ error: "Verkäufer nicht gefunden." }, { status: 404 });
  }

  const count = Math.min(Math.max(Math.round(Number(body.count) || 30), 1), 200);
  let start = Number(body.start);

  if (!Number.isSafeInteger(start) || start <= 0) {
    const [maxCard, maxOrder] = await Promise.all([
      prisma.posNumberCard.aggregate({ where: { sellerId }, _max: { number: true } }),
      prisma.order.aggregate({
        where: { product: { sellerId }, posOrderNumber: { not: null } },
        _max: { posOrderNumber: true },
      }),
    ]);
    const highest = Math.max(maxCard._max.number ?? 0, maxOrder._max.posOrderNumber ?? 0);
    start = highest + 1;
  }

  const batchId = randomUUID();
  const cards = Array.from({ length: count }, (_, i) => ({
    sellerId,
    batchId,
    number: start + i,
  }));

  await prisma.posNumberCard.createMany({ data: cards });

  return NextResponse.json({
    batchId,
    count,
    firstNumber: start,
    lastNumber: start + count - 1,
  });
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireSellerOrSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 401 });
  }

  const url = new URL(request.url);
  const vendor = url.searchParams.get("vendor") ?? "";
  const sellerId = await resolveSellerId(user, vendor || undefined);
  if (!sellerId) {
    return NextResponse.json({ error: "Verkäufer nicht gefunden." }, { status: 404 });
  }

  const cards = await prisma.posNumberCard.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const byBatch = new Map<
    string,
    { count: number; used: number; createdAt: Date; firstNumber: number; lastNumber: number }
  >();
  for (const card of cards) {
    const entry = byBatch.get(card.batchId) ?? {
      count: 0,
      used: 0,
      createdAt: card.createdAt,
      firstNumber: card.number,
      lastNumber: card.number,
    };
    entry.count += 1;
    if (card.used) entry.used += 1;
    entry.createdAt = new Date(Math.min(entry.createdAt.getTime(), card.createdAt.getTime()));
    entry.firstNumber = Math.min(entry.firstNumber, card.number);
    entry.lastNumber = Math.max(entry.lastNumber, card.number);
    byBatch.set(card.batchId, entry);
  }

  const result = Array.from(byBatch.entries())
    .map(([batchId, entry]) => ({ batchId, ...entry }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json(result);
}
