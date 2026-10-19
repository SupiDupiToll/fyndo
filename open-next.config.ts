import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  ...defineCloudflareConfig(),
  // `pnpm build` ruft `opennextjs-cloudflare build` auf, damit Cloudflare
  // Workers Builds (Build command: `pnpm run build`) direkt ein deploybares
  // `.open-next`-Bundle erzeugt. OpenNext würde sonst wieder `pnpm build`
  // ausführen und sich endlos selbst aufrufen – daher hier explizit der
  // reine Next.js-Build.
  buildCommand: "pnpm build:next",
};

export default config;
