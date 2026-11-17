/**
 * Layanan sesi & autentikasi — dependensi diinjeksi, tanpa `next/headers`.
 *
 * Pindah dari `apps/web/src/server/services/auth.service.ts` (Langkah E2). Versi web lama mengikat
 * dirinya ke tiga hal yang membuatnya mustahil dipakai proses lain:
 *
 *   1. `next/headers` (lewat adapter cookie default),
 *   2. `env()` modul web (`@/lib/env`),
 *   3. `prisma` singleton modul web (`@/lib/db/prisma`).
 *
 * Di sini ketiganya menjadi parameter `AuthServiceDeps`. Cookie jar **wajib** disuntik pemanggil —
 * tidak ada default implisit yang menyelinap ke `next/headers`, sehingga paket ini aman diimpor
 * dari Express, worker, maupun test.
 *
 * Kontrak perilaku TIDAK berubah: urutan pemeriksaan lockout → password → MFA → reset counter →
 * sesi → audit dipertahankan persis, termasuk penulisan `loginAttempt` di setiap jalur gagal.
 */
import type { PrismaClient } from "@tfn/db/client";
import type { AuthenticatedUser, SessionCookieJar, SessionCookieOptions } from "./session";
import type { PermissionKey } from "./catalog";
import { sha256Hex, randomToken, decryptSecret } from "./crypto";
import { verifyPassword, verifyAgainstDummy } from "./password";
import { verifyTotp } from "./totp";

export interface AuthEnv {
  APP_URL: string;
  /** Menentukan prefix `__Host-` dan atribut `Secure` — jangan disederhanakan jadi APP_URL saja. */
  NODE_ENV: string;
  SESSION_TTL_HOURS: number;
  SESSION_IDLE_MINUTES: number;
  AUTH_MAX_FAILED_LOGINS: number;
  AUTH_LOCKOUT_MINUTES: number;
  AUTH_ENFORCE_MFA: boolean;
  ENCRYPTION_KEY: string;
}

export interface AuthAuditEvent {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
}

export interface AuthServiceDeps {
  db: PrismaClient;
  /**
   * Dibaca **setiap panggilan**, bukan disalin saat modul dimuat.
   *
   * Versi lama memanggil `env()` di dalam tiap fungsi, jadi perubahan runtime (test memutasi
   * `AUTH_ENFORCE_MFA`, `stubEnv` mengubah `APP_URL`) langsung berlaku. Snapshot di sini pernah
   * membuat test kebijakan MFA salah merah — dan di produksi akan berarti perubahan env butuh
   * restart diam-diam.
   */
  env: () => AuthEnv;
  /** Konteks request (IP / User-Agent) — diisi binding, bukan dibaca paket. */
  audit?: (event: AuthAuditEvent) => Promise<void> | void;
}

export interface LoginResult {
  success: boolean;
  user?: AuthenticatedUser;
  requiresMfa?: boolean;
  error?: string;
  lockedUntil?: Date;
}

/**
 * Nama cookie sesi. Fungsi (bukan konstanta modul) karena nilainya bergantung pada `secure`
 * prefix: `__Host-` hanya sah bila di-set dari HTTPS.
 */
export function sessionCookieName(config: AuthEnv): string {
  return config.NODE_ENV === "production" && config.APP_URL?.startsWith("https://") ? "__Host-bx_session" : "bx_session";
}

export const CSRF_COOKIE_NAME = "bx_csrf";

export interface AuthService {
  getSession(jar: SessionCookieJar): Promise<AuthenticatedUser | null>;
  authenticateCredentials(
    email: string,
    plainPassword: string,
    meta?: { ip?: string; userAgent?: string; totpCode?: string; jar?: SessionCookieJar },
  ): Promise<LoginResult>;
  createSession(
    userId: string,
    meta?: { ip?: string; userAgent?: string },
    mfaVerified?: boolean,
  ): Promise<{ id: string; rawToken: string }>;
  setSessionCookie(rawToken: string, jar: SessionCookieJar): Promise<void>;
  destroySession(jar: SessionCookieJar): Promise<void>;
  cookieName(): string;
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { db } = deps;
  /** Satu-satunya pintu ke konfigurasi: selalu segar, tidak pernah di-snapshot. */
  const env = () => deps.env();
  const cookieName = () => sessionCookieName(env());

  /** Selalu panggil dengan jar eksplisit — paket ini tidak punya sumber cookie implisit. */
  async function getSession(jar: SessionCookieJar): Promise<AuthenticatedUser | null> {
    const rawToken = jar.get(cookieName());
    if (!rawToken) return null;

    const tokenHash = sha256Hex(rawToken);
    const now = new Date();

    const session = await db.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < now || !session.user.isActive) {
      return null;
    }

    // Idle timeout check
    const idleThreshold = env().SESSION_IDLE_MINUTES * 60 * 1000;
    if (now.getTime() - session.lastSeenAt.getTime() > idleThreshold) {
      await db.session.update({ where: { id: session.id }, data: { revokedAt: now } });
      return null;
    }

    // Touch lastSeenAt periodically (every 5 minutes)
    if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    const roleKeys: string[] = [];
    const permissionKeys = new Set<PermissionKey>();

    for (const ur of session.user.roles) {
      roleKeys.push(ur.role.key);
      for (const rp of ur.role.permissions) {
        permissionKeys.add(rp.permission.key as PermissionKey);
      }
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      isActive: session.user.isActive,
      mfaEnabled: session.user.mfaEnabled,
      mfaRequired:
        session.user.mfaEnabled || (env().AUTH_ENFORCE_MFA && session.user.roles.some((r) => r.role.requiresMfa)),
      roles: roleKeys,
      permissions: permissionKeys,
      sessionId: session.id,
      mfaVerified: session.mfaVerified,
    };
  }

  async function createSession(
    userId: string,
    meta?: { ip?: string; userAgent?: string },
    mfaVerified = false,
  ): Promise<{ id: string; rawToken: string }> {
    const rawToken = randomToken(32);
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + env().SESSION_TTL_HOURS * 3600 * 1000);

    const session = await db.session.create({
      data: {
        tokenHash,
        userId,
        mfaVerified,
        ipAddress: meta?.ip?.slice(0, 64),
        userAgent: meta?.userAgent?.slice(0, 255),
        expiresAt,
      },
    });

    return { id: session.id, rawToken };
  }

  async function setSessionCookie(rawToken: string, jar: SessionCookieJar): Promise<void> {
    const options: SessionCookieOptions = {
      httpOnly: true,
      secure: env().NODE_ENV === "production" && env().APP_URL?.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: env().SESSION_TTL_HOURS * 3600,
    };
    jar.set(cookieName(), rawToken, options);
  }

  async function destroySession(jar: SessionCookieJar): Promise<void> {
    const rawToken = jar.get(cookieName());
    if (!rawToken) return;
    await db.session.updateMany({
      where: { tokenHash: sha256Hex(rawToken) },
      data: { revokedAt: new Date() },
    });
    // Bersihkan kedua kemungkinan nama: cookie bisa tertinggal dari konfigurasi APP_URL sebelumnya.
    jar.delete(cookieName());
    jar.delete("bx_session");
    jar.delete("__Host-bx_session");
  }

  /** Authenticates email/password with brute-force prevention and timing resistance */
  async function authenticateCredentials(
    email: string,
    plainPassword: string,
    meta?: { ip?: string; userAgent?: string; totpCode?: string; jar?: SessionCookieJar },
  ): Promise<LoginResult> {
    const normEmail = email.trim().toLowerCase();
    const now = new Date();

    const user = await db.user.findUnique({
      where: { email: normEmail },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      await verifyAgainstDummy(plainPassword);
      await db.loginAttempt.create({
        data: {
          email: normEmail,
          ipAddress: meta?.ip,
          userAgent: meta?.userAgent,
          success: false,
          reason: "USER_NOT_FOUND",
        },
      });
      return { success: false, error: "Invalid email or password" };
    }

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > now) {
      return {
        success: false,
        error: `Account is temporarily locked. Try again after ${user.lockedUntil.toLocaleTimeString()}`,
        lockedUntil: user.lockedUntil,
      };
    }

    if (!user.isActive) {
      return { success: false, error: "Account is disabled. Contact your administrator." };
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, plainPassword);

    if (!isPasswordValid) {
      const nextFailed = user.failedLoginCount + 1;
      const shouldLock = nextFailed >= env().AUTH_MAX_FAILED_LOGINS;
      const lockedUntil = shouldLock ? new Date(now.getTime() + env().AUTH_LOCKOUT_MINUTES * 60 * 1000) : null;

      await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: nextFailed, lockedUntil },
      });

      await db.loginAttempt.create({
        data: {
          email: normEmail,
          ipAddress: meta?.ip,
          userAgent: meta?.userAgent,
          success: false,
          reason: shouldLock ? "LOCKED_MAX_ATTEMPTS" : "INVALID_PASSWORD",
        },
      });

      return {
        success: false,
        error: shouldLock
          ? `Account locked due to multiple failed attempts. Try again in ${env().AUTH_LOCKOUT_MINUTES} minutes.`
          : "Invalid email or password",
      };
    }

    // Enrolled MFA is never disabled by the development role-enforcement switch.
    const mfaRequired = user.mfaEnabled || (env().AUTH_ENFORCE_MFA && user.roles.some((r) => r.role.requiresMfa));
    let mfaVerified = false;
    if (mfaRequired) {
      if (!user.mfaEnabled || !user.mfaSecretEnc) {
        return { success: false, error: "MFA is required but not configured. Contact an administrator." };
      }
      if (!meta?.totpCode) {
        return { success: false, requiresMfa: true, error: "Enter your authenticator code." };
      }
      try {
        const secret = decryptSecret(user.mfaSecretEnc, env().ENCRYPTION_KEY);
        mfaVerified = /^[A-Z2-7]{16,128}$/.test(secret) && verifyTotp(secret, meta.totpCode);
      } catch {
        return { success: false, error: "MFA is unavailable. Contact an administrator." };
      }
      if (!mfaVerified) {
        const failedLoginCount = user.failedLoginCount + 1;
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount,
            lockedUntil:
              failedLoginCount >= env().AUTH_MAX_FAILED_LOGINS
                ? new Date(now.getTime() + env().AUTH_LOCKOUT_MINUTES * 60 * 1000)
                : null,
          },
        });
        await db.loginAttempt.create({
          data: {
            email: normEmail,
            ipAddress: meta?.ip,
            userAgent: meta?.userAgent,
            success: false,
            reason: "INVALID_MFA",
          },
        });
        return { success: false, requiresMfa: true, error: "Invalid authenticator code." };
      }
    }

    // Reset lockout only after all required credentials are verified.
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    });

    await db.loginAttempt.create({
      data: {
        email: normEmail,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        success: true,
      },
    });

    // Create full authenticated session only after all required credentials pass.
    const session = await createSession(user.id, meta, mfaVerified);
    if (meta?.jar) await setSessionCookie(session.rawToken, meta.jar);

    await deps.audit?.({
      actorId: user.id,
      action: "AUTH_LOGIN",
      entityType: "USER",
      entityId: user.id,
      summary: `User ${user.email} signed in successfully`,
    });

    const permissions = new Set<PermissionKey>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.key as PermissionKey);
      }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        mfaEnabled: user.mfaEnabled,
        mfaRequired,
        roles: user.roles.map((r) => r.role.key),
        permissions,
        sessionId: session.id,
        mfaVerified,
      },
    };
  }

  return { getSession, authenticateCredentials, createSession, setSessionCookie, destroySession, cookieName };
}
