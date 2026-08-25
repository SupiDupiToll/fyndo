import { NextResponse } from "next/server";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePosSettings, POS_SETTINGS_DEFAULTS, type PosSettings } from "@/lib/pos-settings";
import { hashAdminCode } from "@/lib/admin-code";

export const dynamic = "force-dynamic";

function resolveSettingsUser(raw: unknown, currentUserId: string, isSuperAdmin: boolean) {
  if (!isSuperAdmin) return { id: currentUserId };
  if (raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).vendor === "string") {
    const vendor = (raw as Record<string, unknown>).vendor as string;
    return { vendor };
  }
  return { id: currentUserId };
}

export async function GET(request: Request) {
  let user;
  try {
    user = await requireSellerOrSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 401 });
  }
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const url = new URL(request.url);
  const vendor = url.searchParams.get("vendor");

  let target;
  if (isSuperAdmin && vendor) {
    target = await prisma.user.findFirst({
      where: {
        OR: [
          { sellerName: { equals: vendor, mode: "insensitive" } },
          { displayName: { equals: vendor, mode: "insensitive" } },
        ],
      },
    });
    if (!target) return NextResponse.json({ error: "Verkäufer nicht gefunden." }, { status: 404 });
  } else {
    target = user;
  }

  const settings = parsePosSettings(target.posSettings);
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  let user;
  try {
    user = await requireSellerOrSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 401 });
  }
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const settings = parsePosSettings(body);
  const bodyRaw = (body ?? {}) as Record<string, unknown>;

  let adminCodeHash = settings.adminCodeHash;
  if (typeof bodyRaw.adminCode === "string" && bodyRaw.adminCode.trim() !== "") {
    adminCodeHash = await hashAdminCode(bodyRaw.adminCode);
  } else if (bodyRaw.clearAdminCode === true) {
    adminCodeHash = "";
  }

  const trimmed: PosSettings = {
    ...POS_SETTINGS_DEFAULTS,
    ...settings,
    adminCodeHash,
    idleTimeoutSeconds: Math.max(5, Math.min(settings.idleTimeoutSeconds, 600)),
    lockWarningSeconds: Math.max(1, Math.min(settings.lockWarningSeconds, 60)),
    successAutoLockSeconds: Math.max(0, Math.min(settings.successAutoLockSeconds, 120)),
    media: settings.media.slice(0, 20),
  };

  const query = resolveSettingsUser(body, user.id, isSuperAdmin);

  let targetId: string;
  if ("vendor" in query && query.vendor) {
    const target = await prisma.user.findFirst({
      where: {
        OR: [
          { sellerName: { equals: query.vendor as string, mode: "insensitive" } },
          { displayName: { equals: query.vendor as string, mode: "insensitive" } },
        ],
      },
    });
    if (!target) return NextResponse.json({ error: "Verkäufer nicht gefunden." }, { status: 404 });
    targetId = target.id;
  } else {
    targetId = query.id as string;
  }

  await prisma.user.update({
    where: { id: targetId },
    data: { posSettings: trimmed },
  });

  return NextResponse.json(trimmed);
}
