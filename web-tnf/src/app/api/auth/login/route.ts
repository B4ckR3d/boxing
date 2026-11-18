import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiFetchRaw, ApiClientError } from "@/lib/api/client";
import { rateLimit } from "@/lib/security/rate-limit";
import { hasValidAuthOrigin } from "../origin";

/**
 * BFF login (Langkah B slice 3, ADR-013).
 *
 * Otoritas auth ada di `apps/api`. Route ini **tidak** mengautentikasi sendiri — ia meneruskan
 * permintaan, lalu:
 *  1. menerjemahkan envelope ADR-010 dari API ke bentuk yang dibaca UI (`{ error: string }`),
 *  2. meneruskan `Set-Cookie` dari API ke browser (cookie tetap terbit dari sisi API, bukan dibuat
 *     ulang di sini — supaya hanya ada satu sumber kebenaran sesi).
 *
 * Rate limit tetap di lapisan ini karena store-nya in-process dan menghadap browser.
 */

/**
 * `identifier` = username ATAU email. `email` tetap diterima untuk kompatibilitas klien lama.
 * Bentuk email TIDAK divalidasi di sini — username yang sah tidak mengandung `@`, jadi aturan
 * "harus format email" justru akan memblokir login username sebelum sampai ke API.
 */
const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, "Username or email is required").max(191).optional(),
    email: z.string().trim().min(1).max(191).optional(),
    password: z.string().min(1, "Password is required").max(1024),
    totpCode: z
      .string()
      .regex(/^\d{6}$/, "MFA code must contain six digits")
      .optional(),
  })
  .refine((data) => Boolean(data.identifier || data.email), {
    message: "Username or email is required",
    path: ["identifier"],
  });

type UpstreamLoginOk = {
  success: boolean;
  user?: { id?: string; email?: string; name?: string; roles?: string[] };
};

export async function POST(request: NextRequest) {
  if (!hasValidAuthOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  const ipLimit = rateLimit("loginIp", ip);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts from this IP. Please wait ${ipLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "retry-after": String(ipLimit.retryAfterSeconds) } },
    );
  }

  // Batas body: Content-Length tidak wajib ada dan tidak bisa dipercaya, jadi stream dibatasi.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
      }
      chunks.push(value);
    }
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input data" },
      { status: 400 },
    );
  }

  // Kunci rate limit memakai identifier apa adanya (username atau email) — satu akun, satu jatah,
  // supaya tidak bisa menghindari batas dengan berganti-ganti bentuk identifier.
  const identifier = (parsed.data.identifier || parsed.data.email || "").toLowerCase();

  const accountLimit = rateLimit("login", identifier);
  if (!accountLimit.allowed) {
    return NextResponse.json(
      { error: `Too many attempts for this account. Please wait ${accountLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "retry-after": String(accountLimit.retryAfterSeconds) } },
    );
  }

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const upstream = await apiFetchRaw<UpstreamLoginOk>("/api/auth/login", {
      method: "POST",
      // Kirim sebagai `identifier` — apps/api yang menentukan username vs email.
      body: {
        identifier,
        password: parsed.data.password,
        ...(parsed.data.totpCode ? { totpCode: parsed.data.totpCode } : {}),
      },
      requestId,
    });

    const response = NextResponse.json(upstream.data);
    // Cookie diteruskan apa adanya dari apps/api (HttpOnly/SameSite/Secure sudah diatur di sana).
    for (const cookie of upstream.setCookies) response.headers.append("set-cookie", cookie);
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      const requiresMfa =
        typeof error.details === "object" &&
        error.details !== null &&
        (error.details as { requiresMfa?: boolean }).requiresMfa === true;

      return NextResponse.json(
        { success: false, ...(requiresMfa ? { requiresMfa: true } : {}), error: error.message },
        { status: error.status, headers: { "x-request-id": error.requestId ?? requestId } },
      );
    }
    console.error("[api/auth/login] proxy error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
