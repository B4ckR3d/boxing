/**
 * Builds the entry ticket PDF (A4, one page) for a CONFIRMED order.
 *
 * Everything is generated server-side with pure-JS libraries (`pdf-lib` + `qrcode`) so the same
 * code runs on a VPS without native deps or headless Chrome. The QR carries the signed payload from
 * `@/lib/ticketing/ticket-token`, which the gate can verify offline.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

export type TicketPdfItem = { name: string; quantity: number; unitPrice: number; subtotal: number };

export type TicketPdfInput = {
  orderNumber: string;
  buyerName: string;
  buyerEmail?: string | null;
  eventName: string;
  venue: string;
  city: string;
  startsAt: Date;
  items: TicketPdfItem[];
  totalAmount: number;
  payload: string;
  /** Audit trail for re-issued/printed copies; defaults to "now". */
  issuedAt?: Date;
};

const A4 = { width: 595.28, height: 841.89 };
const INK = rgb(0.043, 0.047, 0.063);
const PAPER = rgb(0.968, 0.965, 0.949);
const MUTED = rgb(0.42, 0.43, 0.45);
const CRIMSON = rgb(0.78, 0.11, 0.16);
const CHAMP = rgb(0.83, 0.68, 0.32);

/** pdf-lib's standard fonts only cover WinAnsi; strip anything outside it so a name can never crash the job. */
function latin1(value: string): string {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;

const jakartaDate = (date: Date, withTime: boolean) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);

function drawHeader(page: PDFPage, input: TicketPdfInput, fontBold: PDFFont, font: PDFFont) {
  page.drawRectangle({ x: 0, y: A4.height - 172, width: A4.width, height: 172, color: INK });
  page.drawRectangle({ x: 0, y: A4.height - 176, width: A4.width, height: 4, color: CHAMP });

  page.drawText("TEMANGGUNG FIGHT NIGHT", { x: 44, y: A4.height - 52, size: 9, font: fontBold, color: CHAMP });
  page.drawText(latin1(input.eventName).slice(0, 46), { x: 44, y: A4.height - 92, size: 22, font: fontBold, color: PAPER });
  page.drawText(latin1(`${jakartaDate(input.startsAt, true)} WIB`), { x: 44, y: A4.height - 118, size: 11, font, color: PAPER });
  page.drawText(latin1(`${input.venue}, ${input.city}`).slice(0, 60), { x: 44, y: A4.height - 136, size: 11, font, color: MUTED });

  page.drawText("TIKET MASUK", { x: A4.width - 44 - fontBold.widthOfTextAtSize("TIKET MASUK", 9), y: A4.height - 52, size: 9, font: fontBold, color: PAPER });
}

async function drawQrBlock(pdf: PDFDocument, page: PDFPage, png: Uint8Array, payload: string, font: PDFFont, fontBold: PDFFont) {
  const size = 168;
  const x = 44;
  const y = 300;
  page.drawRectangle({ x: x - 12, y: y - 64, width: size + 24, height: size + 132, color: rgb(1, 1, 1), borderColor: rgb(0.85, 0.85, 0.83), borderWidth: 1 });

  const image = await pdf.embedPng(png);
  page.drawImage(image, { x, y, width: size, height: size });

  page.drawText("PINDAI DI PINTU MASUK", { x, y: y - 24, size: 8, font: fontBold, color: MUTED });
  page.drawText("Kode verifikasi (bila pemindai gagal):", { x, y: y - 40, size: 7, font, color: MUTED });
  // Wrap the payload so it always stays inside the white card.
  const payloadLines: string[] = [];
  for (let i = 0; i < payload.length; i += 22) payloadLines.push(payload.slice(i, i + 22));
  payloadLines.slice(0, 3).forEach((line, index) => {
    page.drawText(line, { x, y: y - 52 - index * 9, size: 7, font, color: INK });
  });
}

export async function buildTicketPdf(input: TicketPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tiket ${input.orderNumber} — ${latin1(input.eventName)}`);
  pdf.setAuthor("Temanggung Fight Night");
  pdf.setSubject(`Tiket masuk pesanan ${input.orderNumber}`);
  pdf.setCreationDate(input.issuedAt ?? new Date());

  const page = pdf.addPage([A4.width, A4.height]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: PAPER });

  const qrPng = await QRCode.toBuffer(input.payload, { errorCorrectionLevel: "M", margin: 1, width: 512 });
  drawHeader(page, input, fontBold, font);
  await drawQrBlock(pdf, page, qrPng, input.payload, font, fontBold);

  // Right column: order identity + line items.
  const colX = 260;
  const colWidth = A4.width - colX - 44;
  let y = 470;

  page.drawText("NOMOR PESANAN", { x: colX, y, size: 8, font: fontBold, color: MUTED });
  page.drawText(input.orderNumber, { x: colX, y: y - 20, size: 17, font: fontBold, color: INK });

  y -= 52;
  page.drawText("PEMESAN", { x: colX, y, size: 8, font: fontBold, color: MUTED });
  page.drawText(latin1(input.buyerName).slice(0, 40), { x: colX, y: y - 18, size: 12, font, color: INK });
  if (input.buyerEmail) {
    page.drawText(latin1(input.buyerEmail).slice(0, 44), { x: colX, y: y - 32, size: 9, font, color: MUTED });
  }

  y -= 60;
  page.drawText("RINCIAN", { x: colX, y, size: 8, font: fontBold, color: MUTED });
  y -= 6;
  page.drawLine({ start: { x: colX, y }, end: { x: colX + colWidth, y }, thickness: 0.8, color: rgb(0.8, 0.8, 0.78) });

  y -= 16;
  for (const item of input.items.slice(0, 6)) {
    const name = latin1(item.name).slice(0, 28);
    page.drawText(name, { x: colX, y, size: 10, font, color: INK });
    page.drawText(`${item.quantity}x`, { x: colX + colWidth - 96, y, size: 10, font, color: MUTED });
    const subtotal = rupiah(item.subtotal);
    page.drawText(subtotal, { x: colX + colWidth - font.widthOfTextAtSize(subtotal, 10), y, size: 10, font, color: INK });
    y -= 18;
  }

  y -= 4;
  page.drawLine({ start: { x: colX, y }, end: { x: colX + colWidth, y }, thickness: 0.8, color: rgb(0.8, 0.8, 0.78) });
  y -= 22;
  page.drawText("TOTAL DIBAYAR", { x: colX, y, size: 8, font: fontBold, color: MUTED });
  const total = rupiah(input.totalAmount);
  page.drawText(total, { x: colX, y: y - 20, size: 15, font: fontBold, color: CRIMSON });

  // Legality note + issuance stamp.
  page.drawLine({ start: { x: 44, y: 96 }, end: { x: A4.width - 44, y: 96 }, thickness: 0.8, color: rgb(0.8, 0.8, 0.78) });
  page.drawText(
    latin1("Tiket ini sah bila nomor pesanan dan kode verifikasi cocok dengan daftar panitia. Satu QR berlaku untuk seluruh tiket dalam pesanan ini."),
    { x: 44, y: 80, size: 7.5, font, color: MUTED, maxWidth: A4.width - 88, lineHeight: 10 },
  );
  page.drawText(`Diterbitkan ${jakartaDate(input.issuedAt ?? new Date(), true)} WIB`, {
    x: 44,
    y: 52,
    size: 7.5,
    font,
    color: MUTED,
  });
  page.drawText("TFN - TEMANGGUNG FIGHT NIGHT", {
    x: A4.width - 44 - fontBold.widthOfTextAtSize("TFN - TEMANGGUNG FIGHT NIGHT", 8),
    y: 52,
    size: 8,
    font: fontBold,
    color: INK,
  });

  return pdf.save();
}
