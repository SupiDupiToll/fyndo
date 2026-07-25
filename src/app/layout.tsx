import type { Metadata } from "next";
import { HexclaveProviders } from "@/components/hexclave-providers";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fyndo – Dein smarter Einkaufsmarkt",
  description: "Marketplace – finde alles, was du suchst",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="bg-white text-ink antialiased overflow-x-hidden">
        <HexclaveProviders>{children}</HexclaveProviders>
      </body>
    </html>
  );
}
