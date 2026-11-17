import { NextResponse } from "next/server";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Contoh rute BFF (ADR-013, NT-6): browser memanggil /api/v1/meta di domain web,
 * server web meneruskannya ke `apps/api` /api/v1/meta.
 *
 * Rute ini sengaja dipilih karena hanya-baca dan tidak menyentuh data pribadi —
 * pola yang sama dipakai nanti untuk modul tulis (POST) dengan cookie sesi diteruskan.
 */
export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  try {
    const meta = await apiFetch<Record<string, unknown>>("/api/v1/meta", { requestId });
    return NextResponse.json(meta, { headers: { "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof ApiClientError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details ?? null, requestId: error.requestId ?? requestId } },
        { status: error.status === 503 ? 503 : 502, headers: { "x-request-id": requestId } },
      );
    }
    return NextResponse.json(
      { error: { code: "BFF_ERROR", message: "Gagal meneruskan permintaan ke layanan internal.", details: null, requestId } },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}
