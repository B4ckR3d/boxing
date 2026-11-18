import "server-only";
import { headers } from "next/headers";
import { hmacSha256, safeEqual } from "./crypto";
import { env } from "@/lib/env";

/**
 * Double-submit / signed HMAC CSRF token verification.
 * For mutating endpoints (POST, PUT, PATCH, DELETE):
 * 1. Verifies Origin / Referer matches APP_URL or request Host (CSRF mitigation).
 * 2. Compares token presented in header `x-csrf-token` against signed session/fingerprint.
 */
export function generateCsrfToken(sessionId: string): string {
  const timestamp = Date.now().toString(36);
  const signature = hmacSha256(`${sessionId}:${timestamp}`);
  return `${timestamp}.${signature}`;
}

export function verifyCsrfToken(sessionId: string, token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const [timestamp, signature] = token.split(".");
  if (!timestamp || !signature) return false;

  const expectedSignature = hmacSha256(`${sessionId}:${timestamp}`);
  if (!safeEqual(signature, expectedSignature)) return false;

  // Enforce 24-hour expiration on CSRF tokens
  const parsedTime = parseInt(timestamp, 36);
  if (isNaN(parsedTime) || Date.now() - parsedTime > 24 * 3600 * 1000) {
    return false;
  }
  return true;
}

export async function verifyRequestOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const referer = h.get("referer");
  const host = h.get("host");
  const configuredOrigin = new URL(env().APP_URL).origin;

  if (origin) {
    return origin === configuredOrigin || origin.endsWith(host ?? "___");
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return refOrigin === configuredOrigin || refOrigin.endsWith(host ?? "___");
    } catch {
      return false;
    }
  }

  // Same-origin safe fallback for non-browser agents in development
  return env().NODE_ENV === "development";
}

