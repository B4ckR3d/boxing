import { Router } from "express";
import { ServiceUnavailableError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export interface HealthDeps {
  /** Ping dependency eksternal (DB). Di-inject supaya bisa diuji tanpa MySQL. */
  checkDb: () => Promise<void>;
  startedAt?: number;
}

/**
 * Liveness (`/health`) sengaja tidak menyentuh DB: kalau DB mati, proses tetap hidup dan
 * orchestrator tidak perlu me-restart container.
 * Readiness (`/health/ready`) yang mengecek DB — dipakai load balancer.
 * Detail error DB hanya masuk log, tidak pernah ke response.
 */
export function createHealthRouter({ checkDb, startedAt = Date.now() }: HealthDeps): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "tfn-api",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    });
  });

  router.get("/health/ready", async (req, res, next) => {
    try {
      await checkDb();
      res.json({ status: "ready", checks: { database: "up" } });
    } catch (error) {
      logger().error(
        { requestId: req.requestId, err: error },
        "readiness check failed: database unreachable",
      );
      next(new ServiceUnavailableError("Database tidak dapat dijangkau", { database: "down" }));
    }
  });

  return router;
}
