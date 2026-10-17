import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  __fyndoPrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing environment variable: DATABASE_URL");
  }

  // `PrismaNeonHttp` nutzt Neons HTTP-Treiber (fetch). Das ist der einzige
  // Verbindungsmodus, der auf Cloudflare Workers zuverlässig funktioniert:
  // anders als bei `PrismaNeon` (WebSocket/Pool) wird keine Verbindung
  // gehalten, die eine einzelne Anfrage überleben müsste.
  const adapter = new PrismaNeonHttp(connectionString, {});
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  // Lazy erzeugen: auf Workers wird `process.env` erst zur Laufzeit befüllt,
  // nicht beim Auswerten des Moduls.
  globalForPrisma.__fyndoPrisma ??= createPrismaClient();
  return globalForPrisma.__fyndoPrisma;
}

/**
 * Prisma-Client, der sich wie ein normaler Client verwenden lässt.
 *
 * Dahinter steckt ein Singleton pro Isolate. Das ist hier sicher, weil der
 * HTTP-Treiber zwischen zwei Anfragen keine Verbindung offen hält.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
