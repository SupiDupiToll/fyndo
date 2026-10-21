/**
 * Hexclave-Konfiguration zur Laufzeit.
 *
 * Wichtig für Cloudflare Workers: `@opennextjs/cloudflare` füllt `process.env`
 * erst beim ersten Request (`populateProcessEnv`). Module, die Hexclave-Keys
 * schon beim Import auslesen, sehen auf dem Worker deshalb noch nichts.
 *
 * Zusätzlich werden die Variablen hier über dynamische Schlüssel gelesen
 * (`process.env[key]`). Next.js ersetzt nur statische Zugriffe wie
 * `process.env.NEXT_PUBLIC_*` zur Build-Zeit – dynamische Zugriffe bleiben
 * echte Laufzeit-Lookups und funktionieren damit auch, wenn der Build (z. B.
 * bei Cloudflare Workers Builds) keine `.env` zur Verfügung hatte.
 */

export type HexclaveRuntimeConfig = {
  projectId: string | undefined;
  publishableClientKey: string | undefined;
  secretServerKey: string | undefined;
};

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function getHexclaveRuntimeConfig(): HexclaveRuntimeConfig {
  return {
    projectId:
      readEnv("HEXCLAVE_PROJECT_ID") ?? readEnv("NEXT_PUBLIC_HEXCLAVE_PROJECT_ID"),
    publishableClientKey:
      readEnv("HEXCLAVE_PUBLISHABLE_CLIENT_KEY") ??
      readEnv("NEXT_PUBLIC_HEXCLAVE_PUBLISHABLE_CLIENT_KEY") ??
      readEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY"),
    secretServerKey: readEnv("HEXCLAVE_SECRET_SERVER_KEY"),
  };
}
