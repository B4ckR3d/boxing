import { NextRequest, NextResponse } from "next/server";
import { apiFetchRaw, ApiClientError } from "@/lib/api/client";
import { hasValidAuthOrigin } from "../origin";

/**
 * BFF ganti password (milik sendiri).
 *
 * Semua aturan ada di `apps/api`: verifikasi password lama, policy password baru, pencabutan sesi
 * lain. Route ini hanya meneruskan body + cookie, lalu `Set-Cookie` hasilnya kembali ke browser.
 *
 * `Set-Cookie` tetap diteruskan meski saat ini tidak berubah: sesi yang dipakai dipertahankan oleh
 * API lewat `keepSessionId`, tapi kalau nanti API memutuskan menerbitkan ulang cookie (mis. rotasi
 * token saat ganti password), BFF sudah tidak menghalanginya.
 */

/** Batas body kecil: field-nya hanya dua password. */
const MAX_BODY_BYTES = 4_096;

export async function POST(request: NextRequest) {
  if (!hasValidAuthOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cookie = request.headers.get("cookie");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const upstream = await apiFetchRaw<{ success: boolean }>("/api/auth/change-password", {
      method: "POST",
      body,
      requestId,
      headers: {
        ...(cookie ? { cookie } : {}),
        // Diteruskan apa adanya: penjaga origin di API memeriksa nilai yang benar-benar dikirim
        // browser, bukan nilai karangan sisi server.
        ...(origin ? { origin } : {}),
        ...(!origin && referer ? { referer } : {}),
      },
    });

    const response = NextResponse.json(upstream.data);
    for (const value of upstream.setCookies) response.headers.append("set-cookie", value);
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "x-request-id": error.requestId ?? requestId } },
      );
    }
    console.error("[api/auth/change-password] proxy error:", error);
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
