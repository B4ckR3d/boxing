/**
 * Sesi admin + pemeriksaan permission untuk router Express.
 *
 * Sebelumnya fungsi ini disalin di dalam `routes/ticketing.ts`. Sekarang satu tempat, karena
 * router settings & sponsor membutuhkan aturan yang identik — kalau aturannya berbeda sedikit saja
 * antar router, itu bug otorisasi.
 *
 * Kenapa tidak memakai `guard.requirePermission()` milik web: fungsi itu membaca cookie lewat
 * `next/headers`, yang tidak ada di Express. Di sini sesi diambil dengan jar Express lalu diperiksa
 * dengan `hasPermission()` yang **sama** (termasuk aturan super_admin implisit), jadi matriks
 * permission tidak diduplikasi.
 */
import type { Request } from "express";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import type { PermissionKey } from "@/lib/permissions/catalog";
import { createExpressCookieJar } from "../lib/cookie-jar.js";
import { AppError } from "../lib/errors.js";

export type CookieJarResponse = Parameters<typeof createExpressCookieJar>[1];

export async function requirePermission(req: Request, res: CookieJarResponse, permission: PermissionKey) {
  const user = await getSession(createExpressCookieJar(req, res));
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  if (!hasPermission(user, permission)) {
    throw new AppError(403, "FORBIDDEN", `Required permission missing: ${permission}`);
  }
  return user;
}

/**
 * Origin check gaya Express — padanan `verifyRequestOrigin()` di web yang memakai `next/headers`.
 *
 * Aturannya sama persis supaya pemindahan tidak melunakkan CSRF: Origin (atau Referer) harus cocok
 * dengan `APP_URL`, atau cocok dengan Host request. Tanpa keduanya hanya diizinkan di development.
 */
export function originAllowed(req: Request, appUrl: string): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const sameAs = (value: string | undefined): boolean => {
    if (!value) return false;
    try {
      return new URL(value).origin === new URL(appUrl).origin;
    } catch {
      return false;
    }
  };

  if (origin) return sameAs(origin);
  if (referer) return sameAs(referer);

  // Tidak ada Origin/Referer: hanya agen non-browser (curl, job internal) di development.
  return process.env.NODE_ENV !== "production";
}
