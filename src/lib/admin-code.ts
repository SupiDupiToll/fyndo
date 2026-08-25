// Isomorphe Hash-Hilfsfunktionen (Browser + Node 19+/Edge-kompatibel).
// Ermöglicht einen sicheren Vergleich eines Admin-Codes ohne Klartext-Auslieferung ans Frontend.

const PEPPER = "fyndo::pos::admin::v1::";

/**
 * Bildet einen SHA-256-Hex-Digest des angegebenen Klartexts mit integriertem
 * statischem Pepper, damit schwache Codes nicht direkt per Regenbogentabelle
 * auflösbar sind.
 */
export async function hashAdminCode(input: string): Promise<string> {
  const data = new TextEncoder().encode(PEPPER + input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Konstanter-Zeit-Vergleich zweier Strings, um Timing-Angriffe zu erschweren.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
