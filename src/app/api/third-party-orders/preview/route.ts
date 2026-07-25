import { NextRequest, NextResponse } from "next/server";
import { fetchShopPreview } from "@/lib/third-party-order";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL-Parameter fehlt." }, { status: 400 });
  }

  try {
    const preview = await fetchShopPreview(url);
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof Error && error.message === "URL_SCHEME_UNSUPPORTED") {
      return NextResponse.json({ error: "Nur HTTP und HTTPS werden unterstuetzt." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "URL_HOST_BLOCKED") {
      return NextResponse.json({ error: "Private IPs und Localhost sind blockiert." }, { status: 400 });
    }
    return NextResponse.json({ error: "Vorschau konnte nicht geladen werden." }, { status: 502 });
  }
}
