/**
 * Inti otorisasi murni: matriks permission dibaca dari sesi, bukan dari HTTP.
 *
 * Pindah dari `apps/web/src/lib/permissions/guard.ts`. Yang **tidak** ikut pindah adalah
 * `requireAuth()`/`requirePermission()` yang membaca cookie lewat `next/headers` — itu tetap di
 * binding masing-masing app. Pemisahan ini penting: `apps/api` butuh `hasPermission()` yang sama
 * persis, tapi tidak boleh memaksa `next/headers` ikut masuk ke proses Express.
 */
import type { AuthenticatedUser } from "./session";
import type { PermissionKey } from "./catalog";

export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class FourEyesViolationError extends Error {
  constructor(message = "Four-eyes policy violation: you cannot approve or verify changes you initiated") {
    super(message);
    this.name = "FourEyesViolationError";
  }
}

/**
 * Checks if the user holds a specific permission.
 * Super Admin implicitly has all permissions (also explicitly seeded).
 */
export function hasPermission(user: AuthenticatedUser, permission: PermissionKey): boolean {
  if (user.roles.includes("super_admin")) return true;
  return user.permissions.has(permission);
}

/** Super-admin bypass, dipakai `requireAnyPermission` supaya aturannya satu tempat. */
export function hasAnyPermission(user: AuthenticatedUser, permissions: PermissionKey[]): boolean {
  if (user.roles.includes("super_admin")) return true;
  return permissions.some((p) => user.permissions.has(p));
}

/**
 * Enforces the Four-Eyes policy (Separation of Duties).
 * An actor cannot approve, verify, or certify actions they drafted or submitted.
 * Exception: Super Admin can override in emergency only if configured, but by default four-eyes applies.
 */
export function assertFourEyes(
  actorId: string,
  initiatorId: string | null | undefined,
  contextName = "action",
): void {
  if (initiatorId && actorId === initiatorId) {
    throw new FourEyesViolationError(`Four-eyes policy violation: cannot approve/verify own ${contextName}`);
  }
}
