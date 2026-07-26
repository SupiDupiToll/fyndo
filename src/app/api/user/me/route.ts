import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

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
  });
}
