import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` läuft als `postinstall` und baut keine DB-Verbindung auf.
// In CI (Cloudflare Workers Builds) ist `DATABASE_URL` aber nicht zwingend als
// Build-Variable gesetzt, deshalb ein Platzhalter statt eines harten Fehlers.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
