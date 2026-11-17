import "server-only";
import { getSession, type AuthenticatedUser } from "@/server/services/auth.service";
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
 * Checks if the user holds a specific permission.
 * Super Admin implicitly has all permissions (also explicitly seeded).
 */
export function hasPermission(user: AuthenticatedUser, permission: PermissionKey): boolean {
  if (user.roles.includes("super_admin")) return true;
  return user.permissions.has(permission);
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
  if (user.roles.includes("super_admin")) return user;

  const match = permissions.some((p) => user.permissions.has(p));
  if (!match) {
    throw new AuthorizationError(`Missing one of required permissions: ${permissions.join(", ")}`);
  }
  return user;
}

/**
 * Enforces the Four-Eyes policy (Separation of Duties).
 * An actor cannot approve, verify, or certify actions they drafted or submitted.
 * Exception: Super Admin can override in emergency only if configured, but by default four-eyes applies.
 */
export function assertFourEyes(
  actorId: string,
  initiatorId: string | null | undefined,
  contextName = "action"
): void {
  if (initiatorId && actorId === initiatorId) {
    throw new FourEyesViolationError(
      `Four-eyes policy violation: cannot approve/verify own ${contextName}`
    );
  }
}

