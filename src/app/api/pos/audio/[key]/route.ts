import { NextResponse } from "next/server";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { isAllowedAudioKey, readPosAudio } from "@/lib/pos-audio";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const name = key.replace(/\.mp3$/i, "");

  if (!isAllowedAudioKey(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    await requireSellerOrSuperAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return new NextResponse("Bitte zuerst einloggen.", { status: 401 });
    }
    return new NextResponse("Zugriff verweigert.", { status: 403 });
  }

  const audio = await readPosAudio(name);
  if (!audio) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(audio.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
