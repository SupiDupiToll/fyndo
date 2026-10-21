"use client";

import { HexclaveClientApp, HexclaveProvider, HexclaveTheme } from "@hexclave/next";

type HexclaveProvidersProps = {
  children: React.ReactNode;
  /**
   * Vom Server-Layout zur Laufzeit übergeben. Auf Cloudflare Workers ist
   * `process.env` beim Import dieses Moduls noch leer, deshalb darf die App
   * nicht auf Modulebene erzeugt werden.
   */
  projectId?: string;
  publishableClientKey?: string;
};

function createClientApp(
  projectId?: string,
  publishableClientKey?: string,
) {
  return new HexclaveClientApp({
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
}

let cachedApp: {
  key: string;
  app: ReturnType<typeof createClientApp>;
} | null = null;

function getClientApp(projectId?: string, publishableClientKey?: string) {
  const key = `${projectId ?? ""}\u0000${publishableClientKey ?? ""}`;

  if (cachedApp?.key !== key) {
    cachedApp = { key, app: createClientApp(projectId, publishableClientKey) };
  }

  return cachedApp.app;
}

export function HexclaveProviders({
  children,
  projectId,
  publishableClientKey,
}: HexclaveProvidersProps) {
  const app = getClientApp(projectId, publishableClientKey);

  return (
    <HexclaveProvider app={app}>
      <HexclaveTheme>{children}</HexclaveTheme>
    </HexclaveProvider>
  );
}
