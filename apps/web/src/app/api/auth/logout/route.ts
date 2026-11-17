import { NextRequest, NextResponse } from "next/server";
import { apiFetchRaw, ApiClientError } from "@/lib/api/client";
import { hasValidAuthOrigin } from "../origin";

/**
 * BFF logout (Langkah B slice 3, ADR-013).
 *
 * Sesi dicabut di `apps/api` — route ini hanya meneruskan cookie browser ke API lalu
 * meneruskan `Set-Cookie` penghapusan kembali, sehingga DB dan browser selalu sinkron.
 */
export async function POST(request: NextRequest) {
  if (!hasValidAuthOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const cookie = request.headers.get("cookie");

  try {
    const upstream = await apiFetchRaw<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
      ...(cookie ? { headers: { cookie } } : {}),
    });

    const response = NextResponse.json(upstream.data);
    for (const value of upstream.setCookies) response.headers.append("set-cookie", value);
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      // Sesi yang tidak ada dianggap logout berhasil (idempoten) — UI tidak perlu tahu bedanya.
      if (error.status === 401) return NextResponse.json({ success: true });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/auth/logout] proxy error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
