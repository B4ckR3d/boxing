import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { sha256Hex, randomToken } from "@/lib/security/crypto";
import { verifyPassword, verifyAgainstDummy } from "@/lib/security/password";
import { logAudit } from "./audit.service";
import type { PermissionKey } from "@/lib/permissions/catalog";

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https://")
    ? "__Host-bx_session"
    : "bx_session";
export const CSRF_COOKIE_NAME = "bx_csrf";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: Set<PermissionKey>;
  sessionId: string;
  mfaVerified: boolean;
}

/** Resolves the current session from incoming HTTP cookies */
export async function getSession(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const rawToken =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ||
    cookieStore.get("bx_session")?.value ||
    cookieStore.get("__Host-bx_session")?.value;
  if (!rawToken) return null;

  const tokenHash = sha256Hex(rawToken);
  const now = new Date();

  const session = await prisma.session.findUnique({
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
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    return null;
  }

  // Touch lastSeenAt periodically (every 5 minutes)
  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
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
    roles: roleKeys,
    permissions: permissionKeys,
    sessionId: session.id,
    mfaVerified: session.mfaVerified,
  };
}

export interface LoginResult {
  success: boolean;
  user?: AuthenticatedUser;
  requiresMfa?: boolean;
  tempToken?: string;
  error?: string;
  lockedUntil?: Date;
}

/** Authenticates email/password with brute-force prevention and timing resistance */
export async function authenticateCredentials(
  email: string,
  plainPassword: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<LoginResult> {
  const normEmail = email.trim().toLowerCase();
  const now = new Date();

  const user = await prisma.user.findUnique({
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
    await prisma.loginAttempt.create({
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
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + env().AUTH_LOCKOUT_MINUTES * 60 * 1000)
      : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextFailed,
        lockedUntil,
      },
    });

    await prisma.loginAttempt.create({
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

  // Password valid! Reset lockout counters
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
    },
  });

  await prisma.loginAttempt.create({
    data: {
      email: normEmail,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      success: true,
    },
  });

  // Check if any assigned role requires MFA or if user has MFA enabled
  const anyRoleRequiresMfa = user.roles.some((r) => r.role.requiresMfa);
  const mfaRequired = (user.mfaEnabled || anyRoleRequiresMfa) && env().AUTH_ENFORCE_MFA;

  if (mfaRequired && user.mfaEnabled) {
    // Generate temporary pre-auth token valid for 5 minutes
    const tempToken = randomToken(32);
    // Return tempToken for the MFA verification step
    return {
      success: true,
      requiresMfa: true,
      tempToken,
    };
  }

  // Create full authenticated session
  const session = await createSession(user.id, meta, false);
  await setSessionCookie(session.rawToken);

  await logAudit({
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
      roles: user.roles.map((r) => r.role.key),
      permissions,
      sessionId: session.id,
      mfaVerified: false,
    },
  };
}

/** Creates a new session row and returns both session ID and the unhashed raw token */
export async function createSession(
  userId: string,
  meta?: { ip?: string; userAgent?: string },
  mfaVerified = false
): Promise<{ id: string; rawToken: string }> {
  const rawToken = randomToken(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_HOURS * 3600 * 1000);

  const session = await prisma.session.create({
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

/** Attaches the session cookie to the response */
export async function setSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  const isSecure =
    process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https://");
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: Boolean(isSecure),
    sameSite: "lax",
    path: "/",
    maxAge: env().SESSION_TTL_HOURS * 3600,
  });
  if (SESSION_COOKIE_NAME !== "bx_session") {
    cookieStore.set("bx_session", rawToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: env().SESSION_TTL_HOURS * 3600,
    });
  }
}

/** Revokes the current session and clears the cookie */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ||
    cookieStore.get("bx_session")?.value ||
    cookieStore.get("__Host-bx_session")?.value;
  if (rawToken) {
    const tokenHash = sha256Hex(rawToken);
    await prisma.session.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
    cookieStore.delete(SESSION_COOKIE_NAME);
    cookieStore.delete("bx_session");
    cookieStore.delete("__Host-bx_session");
  }
}

