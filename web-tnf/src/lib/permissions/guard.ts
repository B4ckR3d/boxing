import "server-only";
import { getSession, type AuthenticatedUser } from "@/server/services/auth.service";
import {
  hasPermission,
  hasAnyPermission,
  assertFourEyes,
  AuthenticationError,
  AuthorizationError,
  FourEyesViolationError,
} from "@tfn/auth/permissions";
import type { PermissionKey } from "@tfn/auth/catalog";

/**
 * Guard berbasis request Next.
 *
 * Bagian yang murni (matriks permission, error, four-eyes) sekarang hidup di `@tfn/auth/permissions`
 * supaya `apps/api` memakai aturan yang sama persis tanpa ikut menyeret `next/headers`. Yang tinggal
 * di sini hanya yang memang milik lapisan web: membaca sesi dari cookie request.
 */
export { hasPermission, hasAnyPermission, assertFourEyes, AuthenticationError, AuthorizationError, FourEyesViolationError };
export type { PermissionKey };

/**
 * Asserts the request has an active, valid session.
 * Throws AuthenticationError if not logged in.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await getSession();
  if (!session) {
    throw new AuthenticationError();
  }
  return session;
}

/**
 * Asserts the active session possesses the required permission.
 * Throws AuthenticationError if not logged in, or AuthorizationError if unauthorized.
 */
export async function requirePermission(permission: PermissionKey): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!hasPermission(user, permission)) {
    throw new AuthorizationError(`Required permission missing: ${permission}`);
  }
  return user;
}

/**
 * Asserts the active session possesses AT LEAST ONE of the listed permissions.
 */
export async function requireAnyPermission(permissions: PermissionKey[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (hasAnyPermission(user, permissions)) return user;
  throw new AuthorizationError(`Missing one of required permissions: ${permissions.join(", ")}`);
}
