import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateCredentials } from "@/server/services/auth.service";
import { rateLimit } from "@/lib/security/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || undefined;

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

    const body = await request.json().catch(() => ({}));
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
      { ip, userAgent }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Authentication failed" },
        { status: 401 }
      );
    }

    if (result.requiresMfa) {
      return NextResponse.json({
        requiresMfa: true,
        tempToken: result.tempToken,
      });
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

