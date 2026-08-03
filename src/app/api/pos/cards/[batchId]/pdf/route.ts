import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { requireSellerOrSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPosCardSecret } from "@/lib/env";
import { encodeCardToken } from "@/lib/pos-cards";

export const dynamic = "force-dynamic";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

const COLS = 5;
const ROWS = 6;
const PER_PAGE = COLS * ROWS;
const MARGIN = 24;
const CELL_W = (PAGE_WIDTH - MARGIN * 2) / COLS;
const CELL_H = (PAGE_HEIGHT - MARGIN * 2) / ROWS;

export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  let user;
  try {
    user = await requireSellerOrSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Zugriff verweigert." }, { status: 401 });
  }

  const { batchId } = await params;

  const cards = await prisma.posNumberCard.findMany({
    where: {
      batchId,
      ...(user.role === "SUPER_ADMIN" ? {} : { sellerId: user.id }),
    },
    orderBy: { number: "asc" },
  });

  if (cards.length === 0) {
    return NextResponse.json({ error: "Karten nicht gefunden." }, { status: 404 });
  }

  const secret = getPosCardSecret();
  const sellerId = cards[0].sellerId;

  const qrBuffers = await Promise.all(
    cards.map((card) =>
      QRCode.toBuffer(encodeCardToken(secret, sellerId, card.number), {
        width: 240,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      }),
    ),
  );

  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `FYNDO Bestellnummern-Karten` } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  cards.forEach((card, index) => {
    if (index > 0 && index % PER_PAGE === 0) doc.addPage();
    const col = index % COLS;
    const row = Math.floor(index % PER_PAGE / COLS);
    const x = MARGIN + col * CELL_W;
    const y = MARGIN + row * CELL_H;

    doc.save();
    doc.lineWidth(1);
    doc.dash(3, { space: 3 });
    doc.strokeColor("#94a3b8");
    doc.rect(x + 4, y + 4, CELL_W - 8, CELL_H - 8).stroke();
    doc.restore();

    const qrSize = Math.min(CELL_W, CELL_H) * 0.55;
    doc.image(qrBuffers[index], x + (CELL_W - qrSize) / 2, y + 10, { width: qrSize, height: qrSize });

    doc.fontSize(9).fillColor("#64748b").text("FYNDO", x, y + 10 + qrSize + 8, {
      width: CELL_W - 8,
      align: "center",
    });

    doc.font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#0f172a")
      .text(`#${card.number}`, x, y + 10 + qrSize + 20, {
        width: CELL_W - 8,
        align: "center",
      });

    doc.font("Helvetica")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text(`Karte ${index + 1}/${cards.length} · Bestellnummer-Karte`, x, y + CELL_H - 14, {
        width: CELL_W - 8,
        align: "center",
      });
  });

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fyndo-bestellkarten-${batchId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
