import { Router } from "express";
import { z } from "zod";
import { changeOwnPasswordSchema } from "@tfn/auth/rbac-service";
import { changeOwnPassword, authenticateCredentials, destroySession, getSession } from "../lib/auth.js";
import { createExpressCookieJar } from "../lib/cookie-jar";
import { AppError } from "../lib/errors";
import { env } from "../config/env.js";
import { originAllowed } from "../lib/require-permission.js";

/**
 * Route auth di `apps/api` (Langkah B slice 2).
 *
 * Logika identik dengan `apps/web/src/app/api/auth/*` karena memakai service yang sama —
 * perbedaannya hanya sumber cookie: `createExpressCookieJar(req, res)`.
 *
 * Kontrak: envelope ADR-010 `{ error: { code, message, details?, requestId } }`.
 */

/**
 * `identifier` adalah field baru (username ATAU email). `email` tetap diterima supaya klien lama
 * dan test yang sudah ada tidak pecah — salah satu wajib ada.
 *
 * Validasi bentuk email sengaja TIDAK dilakukan di sini: identifier boleh berupa username, dan
 * penentuan email-vs-username dilakukan di service berdasarkan ada/tidaknya `@`. Kalau route
 * memaksa format email, login pakai username langsung tertolak sebelum sampai ke service.
 */
const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(191).optional(),
    email: z.string().trim().min(1).max(191).optional(),
    password: z.string().min(1, "Password is required").max(1024),
    totpCode: z
      .string()
      .regex(/^\d{6}$/, "MFA code must contain six digits")
      .optional(),
  })
  .refine((data) => Boolean(data.identifier || data.email), {
    message: "Username or email is required",
    path: ["identifier"],
  });

function clientIp(headerValue: string | undefined, fallback: string | undefined): string {
  return headerValue?.split(",")[0]?.trim() || fallback || "127.0.0.1";
}

export function createAuthRouter(): Router {
  const router = Router();

  /** POST /api/auth/login — satu-satunya jalur login di API. */
  router.post("/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid input data", {
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
      }

      const ip = clientIp(req.headers["x-forwarded-for"] as string | undefined, req.ip);
      const userAgent = req.headers["user-agent"]?.slice(0, 255);

      // `identifier` (username ATAU email) diutamakan; `email` hanya fallback klien lama.
      // Keduanya sudah dijamin ada salah satu oleh `loginSchema.refine`.
      const identifier = parsed.data.identifier || parsed.data.email || "";

      const result = await authenticateCredentials(identifier, parsed.data.password, {
        ip: ip.slice(0, 64),
        ...(userAgent ? { userAgent } : {}),
        ...(parsed.data.totpCode ? { totpCode: parsed.data.totpCode } : {}),
        jar: createExpressCookieJar(req, res),
      });

      if (!result.success) {
        throw new AppError(401, "INVALID_CREDENTIALS", result.error || "Authentication failed", {
          details: result.requiresMfa ? { requiresMfa: true } : undefined,
        });
      }

      res.json({
        success: true,
        user: {
          id: result.user?.id,
          username: result.user?.username,
          email: result.user?.email,
          name: result.user?.name,
          roles: result.user?.roles,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /api/auth/logout — mencabut sesi berdasarkan cookie yang dikirim. */
  router.post("/logout", async (req, res, next) => {
    try {
      await destroySession(createExpressCookieJar(req, res));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  /** GET /api/auth/me — profil sesi aktif; 401 bila tidak ada sesi sah. */
  router.get("/me", async (req, res, next) => {
    try {
      const user = await getSession(createExpressCookieJar(req, res));
      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Tidak terautentikasi");
      }
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          roles: user.roles,
          permissions: [...user.permissions],
          mfaVerified: user.mfaVerified,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/auth/change-password — user mengganti password sendiri.
   *
   * Berbeda dari endpoint RBAC: tidak butuh permission apa pun selain sesi sah. Setiap user berhak
   * atas password-nya sendiri, jadi `users.manage` di sini justru salah (akan memaksa admin terlibat
   * untuk hal yang seharusnya privat).
   *
   * Origin tetap diverifikasi: ini mutasi yang mengubah kredensial, target CSRF paling berharga.
   */
  router.post("/change-password", async (req, res, next) => {
    try {
      if (!originAllowed(req, env().APP_URL)) {
        throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
      }

      const user = await getSession(createExpressCookieJar(req, res));
      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Tidak terautentikasi");
      }

      const parsed = changeOwnPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid input data", {
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
      }

      const result = await changeOwnPassword(user.id, parsed.data, user.sessionId);
      if (!result.success) {
        throw new AppError(400, "PASSWORD_CHANGE_FAILED", result.error);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
