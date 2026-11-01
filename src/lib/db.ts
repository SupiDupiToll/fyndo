import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  __fyndoPrisma?: PrismaClient;
};

/**
 * Prisma verpackt `createMany()` und `updateMany()` intern in eine Transaktion,
 * obwohl beide nur aus genau einem SQL-Statement bestehen. Der
 * `PrismaNeonHttp`-Treiber – der einzige, der auf Cloudflare Workers zuverlässig
 * läuft – lehnt `startTransaction()` mit "Transactions are not supported in
 * HTTP mode" ab. Dadurch schlagen u. a. die POS-Bestellung (`createMany`) und
 * alle `updateMany`-Aufrufe (POS bezahlen/stornieren/ausführen, Checkout-
 * Bestätigung, Geschenkkarten) mit einem 500er fehl.
 *
 * Dieser Shim führt das Statement einer Transaktion direkt gegen den Adapter
 * aus und behandelt Commit/Rollback als No-op. Zurückspulen kann er nichts,
 * deshalb erlaubt er pro Transaktion nur ein Statement: echte mehrstufige
 * Transaktionen (`$transaction`) schlagen weiterhin laut fehl, statt still
 * ihre Atomarität zu verlieren.
 */
function withSingleStatementTransactions(factory: PrismaNeonHttp): PrismaNeonHttp {
  const connect = factory.connect.bind(factory);

  factory.connect = async () => {
    const adapter = await connect();
    const queryRaw = adapter.queryRaw.bind(adapter);
    const executeRaw = adapter.executeRaw.bind(adapter);

    adapter.startTransaction = async () => {
      let statements = 0;

      const run = <T>(execute: () => Promise<T>): Promise<T> => {
        statements += 1;
        if (statements > 1) {
          throw new Error(
            "Mehrstufige Datenbank-Transaktionen werden vom Neon-HTTP-Treiber auf Cloudflare Workers nicht unterstützt.",
          );
        }
        return execute();
      };

      return {
        provider: adapter.provider,
        adapterName: adapter.adapterName,
        options: { usePhantomQuery: true },
        queryRaw: (query) => run(() => queryRaw(query)),
        executeRaw: (query) => run(() => executeRaw(query)),
        commit: async () => {},
        rollback: async () => {},
      };
    };

    return adapter;
  };

  return factory;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing environment variable: DATABASE_URL");
  }

  // `PrismaNeonHttp` nutzt Neons HTTP-Treiber (fetch). Das ist der einzige
  // Verbindungsmodus, der auf Cloudflare Workers zuverlässig funktioniert:
  // anders als bei `PrismaNeon` (WebSocket/Pool) wird keine Verbindung
  // gehalten, die eine einzelne Anfrage überleben müsste.
  const adapter = withSingleStatementTransactions(
    new PrismaNeonHttp(connectionString, {}),
  );
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
