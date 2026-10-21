import {
  HexclaveClientApp,
  HexclaveServerApp,
} from "../../node_modules/@hexclave/next/dist/esm/lib/hexclave-app/index.js";
import { getHexclaveRuntimeConfig } from "@/hexclave/config";

let _serverApp: HexclaveServerApp<true> | null = null;

/**
 * Lazy erzeugen: auf Cloudflare Workers ist `process.env` beim Import des
 * Workers noch leer und wird erst beim ersten Request befüllt.
 */
export function hexclaveServerApp(): HexclaveServerApp<true> {
  if (!_serverApp) {
    const { projectId, publishableClientKey, secretServerKey } =
      getHexclaveRuntimeConfig();

    const clientApp = new HexclaveClientApp({
      tokenStore: "nextjs-cookie",
      urls: {
        signIn: "/handler/sign-in",
        signUp: "/handler/sign-up",
        afterSignIn: "/",
        afterSignUp: "/",
        home: "/",
      },
      projectId,
      publishableClientKey,
    });
    _serverApp = new HexclaveServerApp({
      inheritsFrom: clientApp,
      secretServerKey,
    }) as HexclaveServerApp<true>;
  }
  return _serverApp;
}
