import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyRequestOrigin } from "@/lib/security/csrf";

/**
 * BFF guest checkout (Langkah C, ADR-013).
 *
 * Otoritas pembuatan pesanan ada di `apps/api` (`POST /api/ticketing/orders`). Route ini tidak
 * membuat pesanan sendiri — ia menjaga dua hal yang memang milik lapisan web:
 *   1. CSRF/origin check yang dibaca dari request browser (API juga memeriksa, tapi di sini
 *      `next/headers` masih tersedia sehingga pemeriksaan tetap di tempat aslinya),
 *   2. rate limit per IP terhadap browser langsung.
 *
 * Pesan validasi tetap ramah: `apps/api` mengirim `details[].path`, bukan kalimat panjang, jadi
 * kalimat untuk pembeli tiket dirakit di sini (bukan diteruskan mentah dari skema Zod).
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

type CreatedOrder = { orderNumber: string; capabilityToken: string; status: string };

function friendlyValidationMessage(details: unknown): string {
  const issues = Array.isArray(details) ? details : [];
  const first = issues[0] as { path?: unknown } | undefined;
  const path = typeof first?.path === "string" ? first.path.split(".")[0] ?? "" : "";
  return FIELD_MESSAGES[path] ?? "Data pesanan tidak valid. Periksa kembali isian Anda.";
}

export async function POST(request: NextRequest) {
  const originOk = await verifyRequestOrigin();
  if (!originOk) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = rateLimit("publicApi", `ticket-order:${ip}`);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  try {
    const created = await apiFetch<CreatedOrder>("/api/ticketing/orders", {
      method: "POST",
      body,
      // API memeriksa origin dari header ini — tanpa meneruskannya, permintaan sah akan ditolak.
      headers: {
        origin: request.headers.get("origin") ?? "",
        referer: request.headers.get("referer") ?? "",
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.code === "VALIDATION_ERROR") {
        return NextResponse.json({ error: friendlyValidationMessage(error.details) }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[ticketing] unexpected failure", error);
    return NextResponse.json({ error: "Pesanan tidak dapat dibuat. Coba lagi." }, { status: 500 });
  }
}
