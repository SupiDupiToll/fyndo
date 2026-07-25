import {
  HexclaveClientApp,
  HexclaveServerApp,
} from "../../node_modules/@hexclave/next/dist/esm/lib/hexclave-app/index.js";

let _serverApp: HexclaveServerApp<true> | null = null;

export function hexclaveServerApp(): HexclaveServerApp<true> {
  if (!_serverApp) {
    const clientApp = new HexclaveClientApp({
      tokenStore: "nextjs-cookie",
      urls: {
        signIn: "/handler/sign-in",
        signUp: "/handler/sign-up",
        afterSignIn: "/",
        afterSignUp: "/",
        home: "/",
      },
      publishableClientKey:
        process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
    });
    _serverApp = new HexclaveServerApp({
      inheritsFrom: clientApp,
    }) as HexclaveServerApp<true>;
  }
  return _serverApp;
}
