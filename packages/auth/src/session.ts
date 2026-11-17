/**
 * Tipe sesi bersama (tanpa implementasi).
 *
 * Diekstrak supaya `permissions.ts` bisa mengetik `AuthenticatedUser` tanpa mengimpor
 * `apps/web/src/server/services/auth.service.ts`. Implementasi sesungguhnya masih di web (E2 akan
 * memindahkannya ke paket ini dengan dependensi yang diinjeksi).
 */
export interface SessionCookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
}

export interface SessionCookieJar {
  get(name: string): string | undefined;
  set(name: string, value: string, options: SessionCookieOptions): void;
  delete(name: string): void;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  name: string;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaRequired?: boolean;
  roles: string[];
  permissions: Set<import("./catalog.js").PermissionKey>;
  sessionId: string;
  mfaVerified: boolean;
}
