import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createGuestOrder, ticketOrderInputSchema, TicketingError } from "@/server/services/ticketing.service";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyRequestOrigin } from "@/lib/security/csrf";

/**
 * Zod issues are machine-readable, but these messages go straight to a ticket buyer.
 * Map the first failing field to a sentence a human can act on instead of leaking
 * the raw schema shape (field paths, min/max numbers, enum member names).
 */
const FIELD_MESSAGES: Record<string, string> = {
  eventId: "Event tidak valid.",
  ticketTypeId: "Pilih kategori tiket terlebih dahulu.",
  quantity: "Jumlah tiket harus antara 1 dan 10.",
  customerName: "Nama pemesan minimal 2 karakter.",
  customerEmail: "Alamat email tidak valid.",
  customerPhone: "Nomor telepon minimal 5 digit.",
  paymentMethod: "Metode pembayaran tidak dikenali.",
  reference: "Referensi pembayaran terlalu panjang (maksimal 120 karakter).",
};

function friendlyValidationMessage(error: ZodError): string {
  const first = error.issues[0];
  const field = String(first?.path[0] ?? "");
  return FIELD_MESSAGES[field] ?? "Data pesanan tidak valid. Periksa kembali isian Anda.";
}

export async function POST(request: NextRequest) {
  const originOk = await verifyRequestOrigin();
  if (!originOk) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = rateLimit("publicApi", `ticket-order:${ip}`);
  if (!limited.allowed) return NextResponse.json({ error: "Terlalu banyak permintaan" }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } });
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
    }
    const result = await createGuestOrder(ticketOrderInputSchema.parse(body));
    return NextResponse.json({ orderNumber: result.order.orderNumber, capabilityToken: result.capabilityToken, status: result.order.status }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: friendlyValidationMessage(error) }, { status: 400 });
    }
    console.error("[ticketing] unexpected failure", error);
    const status = error instanceof TicketingError && ["SOLD_OUT", "EVENT_UNAVAILABLE", "TICKET_UNAVAILABLE", "PURCHASE_LIMIT"].includes(error.code) ? 409 : 400;
    const message = error instanceof TicketingError ? error.message : "Pesanan tidak dapat dibuat. Coba lagi.";
    return NextResponse.json({ error: message }, { status });
  }
}
