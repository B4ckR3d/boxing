/**
 * Barrel `@tfn/auth`.
 *
 * `session.js` sengaja belum ada di E1 — lihat catatan di NEXT-TASKS: `auth.service` masih terikat
 * `next/headers` + Prisma + crypto di web, dan pemindahannya dikerjakan sebagai E2 supaya tidak
 * setengah jalan. `permissions.ts` hanya memakai `type` dari sana, jadi tidak ada impor runtime.
 */
export * from "./catalog";
export * from "./password";
export * from "./account-policy";
export * from "./rate-limit";
export * from "./permissions";
export type { AuthenticatedUser, SessionCookieJar, SessionCookieOptions } from "./session";
