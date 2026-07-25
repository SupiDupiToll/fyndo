"use client";

import { HexclaveClientApp, HexclaveProvider, HexclaveTheme } from "@hexclave/next";

const hexclaveClientApp = new HexclaveClientApp({
  tokenStore: "nextjs-cookie",
  urls: {
    signIn: "/handler/sign-in",
    signUp: "/handler/sign-up",
    afterSignIn: "/",
    afterSignUp: "/",
    home: "/",
  },
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
});

export function HexclaveProviders({ children }: { children: React.ReactNode }) {
  return (
    <HexclaveProvider app={hexclaveClientApp}>
      <HexclaveTheme>{children}</HexclaveTheme>
    </HexclaveProvider>
  );
}
