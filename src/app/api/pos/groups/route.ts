import { NextResponse } from "next/server";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

  const orders = await prisma.order.findMany({
    where: {
      posGroupId: { not: null },
      ...(isSuperAdmin ? {} : { product: { sellerId: user.id } }),
      ...(scope === "open"
        ? { status: { in: ["PENDING", "DONE"] } }
        : scope === "paid"
          ? { status: { in: ["PAID", "DONE"] } }
          : {}),
    },
    include: {
      product: { select: { title: true, price: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
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

  return NextResponse.json(result);
}
