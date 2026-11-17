/**
 * Router settings & sponsor publik di `apps/api` (Langkah D).
 *
 * Yang dipindah: `settings.service` (baca/tulis organization settings + audit) dan `sponsor.service`
 * (proyeksi sponsor untuk beranda). Keduanya dulu hanya bisa dipakai dari server component Next;
 * sekarang otoritasnya di API dan web tinggal memanggil.
 *
 * Kontrak: envelope `{ data }`, error `{ error: { code, message, requestId } }` (ADR-010).
 * Endpoint publik (`/sponsors`) sengaja tanpa sesi — itu data yang memang tampil di beranda.
 */
import { Router } from "express";
import { z } from "zod";
import { getSettings, updateSettings, SettingsError } from "@tfn/core/settings";
import { getPublicSponsors } from "@tfn/core/sponsors";
import { logAudit, withAuditContext } from "../lib/audit.js";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { originAllowed, requirePermission } from "../lib/require-permission.js";

/** `values` adalah objek key → nilai; validasi per key dilakukan paket (bukan di sini). */
const updateSchema = z.object({ values: z.record(z.string(), z.unknown()) });

function toAppError(error: unknown): unknown {
  if (error instanceof SettingsError) {
    return new AppError(400, "VALIDATION_ERROR", error.message);
  }
  if (error instanceof z.ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Data tidak valid.", {
      details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return error;
}

export function createSettingsRouter(): Router {
  const router = Router();

  /** GET /api/settings — seluruh setting organisasi (default bila baris belum ada). */
  router.get("/", async (_req, res, next) => {
    try {
      res.json({ data: await getSettings({ db: prisma, logAudit }) });
    } catch (error) {
      next(toAppError(error));
    }
  });

  /** PUT /api/settings — butuh `settings.manage`. Body: `{ values: { "branding.general": {...} } }`. */
  router.put("/", async (req, res, next) => {
    try {
      if (!originAllowed(req, env().APP_URL)) throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
      const user = await requirePermission(req, res, "settings.manage");

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;

      // Audit harus mencatat IP/UA petugas yang benar, jadi penulisan dibungkus konteks request.
      const result = await withAuditContext(req, async () => {
        const applied = await updateSettings({ db: prisma, logAudit }, user.id, parsed.data.values);
        return { applied, settings: await getSettings({ db: prisma, logAudit }) };
      });
      res.json({ data: result });
    } catch (error) {
      next(toAppError(error));
    }
  });

  return router;
}

export function createSponsorsRouter(): Router {
  const router = Router();

  /**
   * GET /api/sponsors — sponsor aktif untuk beranda. Publik, tanpa sesi.
   * Hanya `isActive` dan logo yang belum dihapus; tanpa sponsor aktif hasilnya `[]`.
   */
  router.get("/", async (_req, res, next) => {
    try {
      res.json({ data: await getPublicSponsors(prisma) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
