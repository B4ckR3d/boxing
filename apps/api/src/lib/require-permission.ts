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
import { getSession } from "./auth.js";
import { hasPermission } from "@tfn/auth/permissions";
import type { PermissionKey } from "@tfn/auth/catalog";
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
 *
 * Escape hatch development, sama seperti `apps/web/src/app/api/auth/origin.ts`: `.env` sengaja
 * memakai `APP_URL=https://tfn.pimpom.id` agar perilakunya mirip produksi, sehingga membuka
 * `http://localhost:3000` akan membuat origin loopback tidak cocok. Loopback diterima **hanya saat
 * NODE_ENV=development**; di produksi cabang ini mati, jadi CSRF tidak dilonggarkan.
 */
/**
 * `NODE_ENV` efektif — **harus** memakai default yang sama dengan skema env (`config/env.ts`).
 *
 * Jangan baca `process.env.NODE_ENV` mentah: `pnpm start` tidak mengekspornya, jadi nilainya
 * `undefined` walau aplikasi secara efektif berjalan sebagai development. Akibatnya escape hatch
 * loopback tidak pernah aktif dan semua mutasi dari UI lokal kena 403. Sebaliknya di produksi
 * `NODE_ENV=production` wajib di-set eksplisit (dilakukan PM2), sehingga cabang ini tetap mati.
 */
function nodeEnv(): string {
  return process.env.NODE_ENV ?? "development";
}

function isLocalDevOrigin(value: string): boolean {
  if (nodeEnv() !== "development") return false;
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

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

  if (origin) return sameAs(origin) || isLocalDevOrigin(origin);
  if (referer) return sameAs(referer) || isLocalDevOrigin(referer);

  // Tidak ada Origin/Referer: hanya agen non-browser (curl, job internal) di development.
  return nodeEnv() !== "production";
}
