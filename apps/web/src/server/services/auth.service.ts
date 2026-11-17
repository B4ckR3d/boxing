import "server-only";
import { createAuthService, sessionCookieName, type AuthEnv, type LoginResult } from "@tfn/auth/session-service";
import type { AuthenticatedUser, SessionCookieJar } from "@tfn/auth/session";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { nextSessionCookieJar } from "./next-session-cookie-jar";
import { logAudit } from "./audit.service";

/**
 * Binding web untuk `@tfn/auth` (Langkah E2).
 *
 * Logika autentikasi tidak lagi tinggal di sini — yang tersisa hanya penyuntikan dependensi proses
 * web: Prisma singleton, `env()`, dan cookie jar berbasis `next/headers`. Dengan begitu
 * `apps/api` memakai implementasi yang sama tanpa perlu alias `@/` ke `apps/web/src`.
 */
function authEnv(): AuthEnv {
  const e = env();
  return {
    // `process.env` diutamakan — ini semantik asli (dan satu-satunya cara test bisa mem-`stubEnv`).
    APP_URL: process.env.APP_URL ?? e.APP_URL,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    SESSION_TTL_HOURS: e.SESSION_TTL_HOURS,
    SESSION_IDLE_MINUTES: e.SESSION_IDLE_MINUTES,
    AUTH_MAX_FAILED_LOGINS: e.AUTH_MAX_FAILED_LOGINS,
    AUTH_LOCKOUT_MINUTES: e.AUTH_LOCKOUT_MINUTES,
    AUTH_ENFORCE_MFA: e.AUTH_ENFORCE_MFA,
    ENCRYPTION_KEY: e.ENCRYPTION_KEY,
  };
}

const service = createAuthService({
  db: prisma,
  // Getter, bukan objek: `env()` dibaca ulang tiap panggilan supaya `stubEnv`/mutasi runtime berlaku.
  env: authEnv,
  audit: (event) => logAudit(event),
});

export const SESSION_COOKIE_NAME = sessionCookieName(authEnv());
export const CSRF_COOKIE_NAME = "bx_csrf";

export type { AuthenticatedUser, LoginResult };

/**
 * Resolves the current session from incoming HTTP cookies.
 *
 * `jar` opsional: pemanggil tetap boleh menyuntik jar sendiri (test/integrasi). Tanpa `jar`,
 * cookie dibaca dari `next/headers` — perilaku lama dipertahankan di lapisan binding, bukan di paket.
 */
export async function getSession(jar?: SessionCookieJar): Promise<AuthenticatedUser | null> {
  return service.getSession(jar ?? (await nextSessionCookieJar()));
}

export async function authenticateCredentials(
  email: string,
  plainPassword: string,
  meta?: { ip?: string; userAgent?: string; totpCode?: string; jar?: SessionCookieJar },
): Promise<LoginResult> {
  // Jar default disuntik di sini supaya kontrak lama (cookie selalu ter-set saat login) tetap utuh.
  const jar = meta?.jar ?? (await nextSessionCookieJar());
  return service.authenticateCredentials(email, plainPassword, { ...meta, jar });
}

export async function createSession(
  userId: string,
  meta?: { ip?: string; userAgent?: string },
  mfaVerified = false,
): Promise<{ id: string; rawToken: string }> {
  return service.createSession(userId, meta, mfaVerified);
}

export async function setSessionCookie(rawToken: string, jar?: SessionCookieJar): Promise<void> {
  return service.setSessionCookie(rawToken, jar ?? (await nextSessionCookieJar()));
}

export async function destroySession(jar?: SessionCookieJar): Promise<void> {
  return service.destroySession(jar ?? (await nextSessionCookieJar()));
}
