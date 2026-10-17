import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { POS_ANNOUNCEMENT_KEYS } from "@/lib/pos-announcement-keys";

const ALLOWED = new Set<string>(POS_ANNOUNCEMENT_KEYS);

// Pfad-Präfix der MP3s innerhalb der Static Assets (`public/pos-audio`).
const ASSET_PREFIX = "/pos-audio";

export function isAllowedAudioKey(name: string): boolean {
  return ALLOWED.has(name);
}

/**
 * Liefert die MP3-Bytes einer POS-Ansage als `Response` oder `null`.
 *
 * Auf Cloudflare Workers gibt es kein Dateisystem; die Dateien liegen als
 * Static Assets vor und werden über die `ASSETS`-Binding geladen. Der
 * Direktzugriff auf `/pos-audio/*` ist in `src/proxy.ts` gesperrt – ausgeliefert
 * wird nur über die authentifizierte Route `/api/pos/audio/[key]`.
 */
export async function readPosAudio(name: string): Promise<Response | null> {
  try {
    const { env } = getCloudflareContext();
    const assets = env.ASSETS;
    if (assets) {
      const response = await assets.fetch(
        new URL(`${ASSET_PREFIX}/${name}.mp3`, "https://assets.local"),
      );
      return response.ok ? response : null;
    }
  } catch {
    // Kein Cloudflare-Kontext (z. B. einfaches `next dev` ohne Wrangler).
  }

  // Fallback für die lokale Entwicklung: direkt aus `public/` lesen.
  if (process.env.NODE_ENV !== "production") {
    try {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const buffer = await readFile(
        path.join(process.cwd(), "public", "pos-audio", `${name}.mp3`),
      );
      return new Response(new Uint8Array(buffer), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    } catch {
      return null;
    }
  }

  return null;
}
