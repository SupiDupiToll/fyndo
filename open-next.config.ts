import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Alle Seiten der App sind `force-dynamic`, es gibt also keine ISR/SSG-Daten,
// die über einen Incremental Cache gehalten werden müssten. Deshalb reicht die
// Standard-Konfiguration ohne zusätzliche Cache-Bindings (R2/D1/KV).
export default defineCloudflareConfig();
