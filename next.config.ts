import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Prisma's generierter Client (inkl. Query-Compiler-WASM) wird für die
  // `workerd`-Runtime gebaut und darf nicht von Next vorab gebündelt werden.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;

// Stellt `next dev` die Cloudflare-Bindings (u. a. `ASSETS`) zur Verfügung,
// damit sich die App lokal wie auf einem Worker verhält.
initOpenNextCloudflareForDev();
