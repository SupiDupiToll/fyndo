import { NextResponse } from "next/server";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { POS_ANNOUNCEMENT_KEYS } from "@/lib/pos-announcement-keys";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const AUDIO_DIR = path.join(process.cwd(), "private", "audio", "pos");
const ALLOWED = new Set<string>(POS_ANNOUNCEMENT_KEYS);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const name = key.replace(/\.mp3$/i, "");

  if (!ALLOWED.has(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let user;
  try {
    user = await requireSellerOrSuperAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return new NextResponse("Bitte zuerst einloggen.", { status: 401 });
    }
    return new NextResponse("Zugriff verweigert.", { status: 403 });
  }

  void user;

  try {
    const buffer = await readFile(path.join(AUDIO_DIR, `${name}.mp3`));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
