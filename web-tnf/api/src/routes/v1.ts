import { Router } from "express";

export interface V1Deps {
  version: string;
}

/**
 * Router versi pertama (`/api/v1`).
 *
 * Standar: setiap modul baru mendapat file sendiri di `src/routes/v1/<modul>.ts`
 * dan didaftarkan di sini. Modul bisnis (ticketing, fighter, dst.) BELUM dipindah —
 * lihat ADR-001: pemindahan menunggu migration plan yang disetujui.
 */
export function createV1Router({ version }: V1Deps): Router {
  const router = Router();

  router.get("/meta", (_req, res) => {
    res.json({
      service: "tfn-api",
      version,
      status: "skeleton",
      modules: [] as string[],
      note: "Belum ada modul bisnis di API. Lihat docs/02-ARCHITECTURE/MONOREPO-STRUCTURE.md",
    });
  });

  return router;
}
