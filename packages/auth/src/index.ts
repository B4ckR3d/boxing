/**
 * Barrel `@tfn/auth`.
 *
 * Semua domain auth murni ada di sini: katalog permission, matriks otorisasi, kebijakan
 * password/akun, rate limit, primitif kripto, TOTP, dan layanan sesi berbasis injeksi.
 *
 * Yang **tidak** ada di sini: apa pun yang membaca request. `next/headers` dan `req.cookies`
 * hidup di binding masing-masing app (`apps/web`, `apps/api`).
 */
export * from "./catalog";
export * from "./password";
export * from "./account-policy";
export * from "./rate-limit";
export * from "./permissions";
export * from "./crypto";
export * from "./totp";
export * from "./session.service";
export type { AuthenticatedUser, SessionCookieJar, SessionCookieOptions } from "./session";
