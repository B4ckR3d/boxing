import { createAuthService, CSRF_COOKIE_NAME, sessionCookieName, type AuthEnv } from "@tfn/auth/session-service";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { logAudit } from "./audit.js";
import type { AuthenticatedUser, SessionCookieJar } from "@tfn/auth/session";

/**
 * Binding `apps/api` untuk `@tfn/auth` (Langkah E2).
 *
 * Sebelumnya route auth di sini mengimpor `@/server/services/auth.service` — alias yang menunjuk ke
 * `apps/web/src`. Artinya API bergantung pada pohon sumber Next, termasuk shim `server-only` dan
 * `next/headers`. Setelah pemindahan, arahnya benar: API memakai paket yang sama dengan web, dan
 * yang berbeda hanya sumber cookie (Express, bukan `next/headers`).
 */
function authEnv(): AuthEnv {
  const e = env();
  return {
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
export { CSRF_COOKIE_NAME };
export type { AuthenticatedUser, SessionCookieJar };

/** Semua fungsi di bawah **wajib** menerima jar Express — paket tidak punya sumber cookie implisit. */
export function getSession(jar: SessionCookieJar): Promise<AuthenticatedUser | null> {
  return service.getSession(jar);
}

export function authenticateCredentials(
  email: string,
  plainPassword: string,
  meta: { ip?: string; userAgent?: string; totpCode?: string; jar: SessionCookieJar },
) {
  return service.authenticateCredentials(email, plainPassword, meta);
}

export function createSession(userId: string, meta?: { ip?: string; userAgent?: string }, mfaVerified = false) {
  return service.createSession(userId, meta, mfaVerified);
}

export function setSessionCookie(rawToken: string, jar: SessionCookieJar) {
  return service.setSessionCookie(rawToken, jar);
}

export function destroySession(jar: SessionCookieJar) {
  return service.destroySession(jar);
}

export function changeOwnPassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
  keepSessionId: string,
) {
  return service.changeOwnPassword(userId, input, keepSessionId);
}
