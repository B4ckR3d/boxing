import { Router } from "express";
import { z } from "zod";
import { authenticateCredentials, destroySession, getSession } from "../lib/auth.js";
import { createExpressCookieJar } from "../lib/cookie-jar";
import { AppError } from "../lib/errors";

/**
 * Route auth di `apps/api` (Langkah B slice 2).
 *
 * Logika identik dengan `apps/web/src/app/api/auth/*` karena memakai service yang sama —
 * perbedaannya hanya sumber cookie: `createExpressCookieJar(req, res)`.
 *
 * Kontrak: envelope ADR-010 `{ error: { code, message, details?, requestId } }`.
 */

const loginSchema = z.object({
  email: z.string().trim().max(191).email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(1024),
  totpCode: z
    .string()
    .regex(/^\d{6}$/, "MFA code must contain six digits")
    .optional(),
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

      const result = await authenticateCredentials(parsed.data.email, parsed.data.password, {
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

  return router;
}
