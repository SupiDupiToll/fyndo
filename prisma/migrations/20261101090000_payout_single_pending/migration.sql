-- Nur eine offene Auszahlung pro Verkäufer.
--
-- Auf Cloudflare Workers läuft Prisma über den Neon-HTTP-Treiber, der keine
-- mehrstufigen Transaktionen (und damit kein `SELECT ... FOR UPDATE`) kann.
-- Die Nebenläufigkeit beim Anlegen einer Auszahlung wird deshalb über diesen
-- partiellen Unique-Index abgesichert (`ON CONFLICT ("sellerId")
-- WHERE "status" = 'PENDING' DO NOTHING` in
-- `src/app/api/admin/payout-request/route.ts`).
--
-- Hinweis: Der Index ist bewusst nur in dieser Migration definiert (Prisma 7
-- kann partielle Indizes nicht im Schema abbilden). `prisma migrate deploy`
-- wendet ihn an; `prisma migrate dev` würde ihn als Drift sehen.
CREATE UNIQUE INDEX "Payout_sellerId_pending_key"
ON "Payout" ("sellerId")
WHERE "status" = 'PENDING';
