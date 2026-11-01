import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { createRbankPayout, RbankPayoutError } from "@/lib/rbank";
import { isDemoUser } from "@/lib/demo";

export async function POST(request: NextRequest) {
  let note = "";

  try {
    const user = await requireUser();

    if (user.role !== "SELLER") {
      return NextResponse.json({ error: "Nur Verkäufer können eine Auszahlung beantragen." }, { status: 403 });
    }

    if (isDemoUser(user)) {
      return NextResponse.json({ error: "Demo-Nutzer können keine Auszahlung anfordern." }, { status: 403 });
    }

    try {
      const body = (await request.json()) as { note?: string };
      note = typeof body.note === "string" ? body.note.trim() : "";
    } catch {
      note = "";
    }

    const balanceCents = user.sellerBalanceCents;
    if (balanceCents <= 0) {
      return NextResponse.json({ error: "Dein Guthaben beträgt 0 €." }, { status: 400 });
    }

    const feeCents = Math.round(balanceCents * 0.05) + 55;
    const netCents = Math.max(balanceCents - feeCents, 0);

    if (netCents <= 0) {
      return NextResponse.json({ error: "Nach Abzug der Gebühr bleibt kein Auszahlungsbetrag übrig." }, { status: 400 });
    }

    const sellerName = user.sellerName?.trim() || user.displayName;
    const description = `Fyndo Auszahlung ${sellerName}${note ? ` – ${note}` : ""}`.slice(0, 120);

    // Offene Auszahlung finden oder anlegen. Der partielle Unique-Index
    // "Payout_sellerId_pending_key" garantiert, dass parallele Anfragen keine
    // zweite offene Auszahlung für denselben Verkäufer starten – ein
    // mehrstufiges SELECT ... FOR UPDATE ist mit dem Neon-HTTP-Treiber auf
    // Cloudflare Workers nicht möglich (keine Transaktionen/Sessions).
    const idempotencyKey = `fyndo-payout-${user.id}-${crypto.randomUUID()}`;
    const created = await prisma.$queryRaw<
      { id: string; amountCents: number; feeCents: number; idempotencyKey: string }[]
    >`
      INSERT INTO "Payout" (
        "id", "sellerId", "amountCents", "feeCents", "note",
        "idempotencyKey", "status", "createdAt"
      )
      VALUES (
        ${crypto.randomUUID()}, ${user.id}, ${netCents}, ${feeCents}, ${note || null},
        ${idempotencyKey}, 'PENDING', ${new Date()}
      )
      ON CONFLICT ("sellerId") WHERE "status" = 'PENDING' DO NOTHING
      RETURNING "id", "amountCents", "feeCents", "idempotencyKey"
    `;

    const payout =
      created[0] ??
      (await prisma.payout.findFirst({
        where: { sellerId: user.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }));

    if (!payout) {
      return NextResponse.json(
        { error: "Offene Auszahlung konnte nicht ermittelt werden." },
        { status: 500 },
      );
    }

    try {
      // Bei einem erneuten Versuch (z. B. nach Timeout) wird derselbe idempotencyKey an
      // RBank gesendet – RBank liefert dann die ursprüngliche Auszahlung statt doppelt zu zahlen.
      const result = await createRbankPayout({
        amount: payout.amountCents,
        currency: "EUR",
        email: user.email,
        description,
        metadata: {
          sellerId: user.id,
          sellerEmail: user.email,
          payoutId: payout.id,
        },
        idempotencyKey: payout.idempotencyKey,
      });

      // Statuswechsel und Saldo-Abzug in einem einzigen Statement (CTE), damit
      // beides atomar passiert – mehrstufige Transaktionen gehen auf Workers nicht.
      const settled = await prisma.$executeRaw`
        WITH payout AS (
          UPDATE "Payout"
          SET "status" = 'COMPLETED',
              "rbankPayoutId" = ${result.id},
              "error" = NULL,
              "completedAt" = ${new Date()}
          WHERE "id" = ${payout.id}
          RETURNING "amountCents", "feeCents"
        )
        UPDATE "User"
        SET "sellerBalanceCents" = "sellerBalanceCents" - (SELECT "amountCents" + "feeCents" FROM payout)
        WHERE "id" = ${user.id} AND EXISTS (SELECT 1 FROM payout)
      `;

      if (settled === 0) {
        throw new Error("Auszahlung konnte nicht verbucht werden.");
      }

      return NextResponse.json({
        message: `Auszahlung von ${formatEuro(payout.amountCents)} wurde auf dein RBank-Konto überwiesen.`,
        payoutId: result.id,
      });
    } catch (error) {
      // Nur definitive Ablehnungen von RBank als fehlgeschlagen markieren – dann startet
      // ein neuer Versuch mit frischem idempotencyKey. Bei Netzwerk-/Timeout-Fehlern bleibt
      // der Status PENDING, damit der Retry denselben Key verwendet und nicht doppelt zahlt.
      if (error instanceof RbankPayoutError && [400, 401, 404, 422].includes(error.status)) {
        await prisma.payout
          .update({
            where: { id: payout.id },
            data: { status: "FAILED", error: error.message },
          })
          .catch(() => {});
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }

    if (error instanceof RbankPayoutError) {
      const status = error.status === 400 || error.status === 404 || error.status === 422 ? error.status : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("Payout request failed:", error);
    return NextResponse.json({ error: "Auszahlung konnte nicht ausgeführt werden." }, { status: 500 });
  }
}
