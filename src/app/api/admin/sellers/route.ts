import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hexclaveServerApp } from "@/hexclave/server";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const sellers = await prisma.user.findMany({
    where: { OR: [{ role: "SELLER" }, { role: "SUPER_ADMIN" }] },
    include: { _count: { select: { products: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sellers);
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = await request.json();
  const { email, sellerName } = body;

  if (!email || !sellerName) {
    return NextResponse.json({ error: "E-Mail und Verkäufername sind erforderlich" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    if (existingUser.role === "SELLER") {
      return NextResponse.json({ error: "User ist bereits ein Verkäufer" }, { status: 409 });
    }

    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: "SELLER", sellerName },
    });
    return NextResponse.json(updated);
  }

  try {
    const [stackUser] = await hexclaveServerApp().listUsers({
      query: normalizedEmail,
      limit: 1,
    });

    if (!stackUser) {
      return NextResponse.json({ error: "User nicht in Hexclave gefunden. Der User muss sich zuerst registrieren." }, { status: 404 });
    }

    const stackUserId = String(stackUser.id);
    const displayName = String(stackUser.displayName || normalizedEmail);

    const user = await prisma.user.create({
      data: {
        stackUserId,
        email: normalizedEmail,
        displayName,
        role: "SELLER",
        sellerName,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "User konnte nicht in Hexclave gefunden werden" }, { status: 404 });
  }
}
