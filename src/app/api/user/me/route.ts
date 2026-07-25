import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    role: user.role,
    sellerName: user.sellerName,
    email: user.email,
    displayName: user.displayName,
    rbankMerchantId: user.rbankMerchantId,
    rbankMerchantSecret: user.rbankMerchantSecret,
    rbankApiUrl: user.rbankApiUrl,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  if (user.role !== "SELLER" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Nur Verkäufer dürfen Zahlungseinstellungen ändern." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      rbankMerchantId?: string | null;
      rbankMerchantSecret?: string | null;
      rbankApiUrl?: string | null;
    };

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.rbankMerchantId !== undefined && { rbankMerchantId: body.rbankMerchantId }),
        ...(body.rbankMerchantSecret !== undefined && { rbankMerchantSecret: body.rbankMerchantSecret }),
        ...(body.rbankApiUrl !== undefined && { rbankApiUrl: body.rbankApiUrl }),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Fehler beim Speichern." }, { status: 500 });
  }
}
