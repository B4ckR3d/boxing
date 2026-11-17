import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateCredentials } from "@/server/services/auth.service";
import { rateLimit } from "@/lib/security/rate-limit";
import { hasValidAuthOrigin } from "../origin";

const loginSchema = z.object({
  email: z.string().trim().max(191).email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(1024),
  totpCode: z.string().regex(/^\d{6}$/, "MFA code must contain six digits").optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!hasValidAuthOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent")?.slice(0, 255) || undefined;

    // 1. IP Rate Limiting
    const ipLimit = rateLimit("loginIp", ip);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts from this IP. Please wait ${ipLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    // Bound the streamed body too: Content-Length is optional and untrusted.
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
        { status: 400 }
      );
    }

    // 2. Email-based Rate Limiting
    const emailLimit = rateLimit("login", parsed.data.email.toLowerCase());
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many attempts for this account. Please wait ${emailLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    // 3. Authenticate Credentials
    const result = await authenticateCredentials(
      parsed.data.email,
      parsed.data.password,
      { ip: ip.slice(0, 64), userAgent, totpCode: parsed.data.totpCode }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, ...(result.requiresMfa ? { requiresMfa: true } : {}), error: result.error || "Authentication failed" },
        { status: 401 }
      );
    }


    return NextResponse.json({
      success: true,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        name: result.user?.name,
        roles: result.user?.roles,
      },
    });
  } catch (err) {
    console.error("[api/auth/login] Internal error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

