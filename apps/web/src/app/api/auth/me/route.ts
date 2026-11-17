import { NextRequest, NextResponse } from "next/server";
import { apiFetchRaw, ApiClientError } from "@/lib/api/client";

/**
 * BFF `GET /api/auth/me` (Langkah B slice 3, ADR-013).
 *
 * Membaca sesi lewat `apps/api` (satu sumber kebenaran), bukan dari cookie di sisi Next.
 * Cookie browser diteruskan ke API; 401 dari API diteruskan apa adanya.
 */
export async function GET(request: NextRequest) {
  const cookie = request.headers.get("cookie");

  try {
    const upstream = await apiFetchRaw<{ user: unknown }>("/api/auth/me", {
      ...(cookie ? { headers: { cookie } } : {}),
    });
    return NextResponse.json(upstream.data);
  } catch (error) {
    if (error instanceof ApiClientError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status: error.status,
          ...(error.requestId ? { headers: { "x-request-id": error.requestId } } : {}),
        },
      );
    }
    console.error("[api/auth/me] proxy error:", error);
    return NextResponse.json({ error: "Gagal membaca sesi" }, { status: 500 });
  }
}
