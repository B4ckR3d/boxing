import cors from "cors";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { mountApiDocs } from "./docs/openapi.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { requestContext } from "./middleware/request-context.js";
import { createHealthRouter } from "./routes/health.js";
import { createV1Router } from "./routes/v1.js";
import { createAuthRouter } from "./routes/auth.js";
// Ticketing dipindah ke ticket-tnf (18 Nov 2026) — impor dipertahankan hanya bila router dihidupkan lagi.
// import { createTicketingRouter } from "./routes/ticketing.js";
import { createSettingsRouter, createSponsorsRouter } from "./routes/settings.js";
import { createRbacRouter } from "./routes/rbac.js";

export interface AppDeps {
  /** Ping database untuk readiness. Di-inject agar test tidak butuh MySQL. */
  checkDb: () => Promise<void>;
  version?: string;
  /** Override untuk test (mis. mematikan dokumentasi). Default mengikuti env. */
  openApiEnabled?: boolean;
}

/**
 * Factory, bukan module-level singleton: test membuat app baru per-suite tanpa
 * port dan tanpa state global.
 */
export function createApp({ checkDb, version = "0.1.0", openApiEnabled }: AppDeps): Express {
  const e = env();
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "1mb" }));
  app.use(requestContext);

  app.use(
    pinoHttp({
      logger: logger(),
      genReqId: (req) => (req as unknown as { requestId: string }).requestId,
      autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/health/ready" },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );

  app.use(
    cors({
      origin: e.corsOrigins.length > 0 ? e.corsOrigins : false,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-CSRF-Token"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 600,
    }),
  );

  app.use(createHealthRouter({ checkDb }));
  app.use("/api/v1", createV1Router({ version }));
  app.use("/api/auth", createAuthRouter());
  // Ticketing (18 Nov 2026): dipindah ke aplikasi terpisah `ticket-tnf`.
  // Endpoint /api/ticketing sengaja TIDAK didaftarkan lagi — jangan hidupkan kembali di sini,
  // order tiket harus dibuat di DB `tfn_ticketing` lewat ticket-tnf, bukan di DB `boxing`.
  // Router lama masih tersimpan di src/routes/ticketing.ts sebagai referensi migrasi.
  // app.use("/api/ticketing", createTicketingRouter());
  app.use("/api/settings", createSettingsRouter());
  app.use("/api/sponsors", createSponsorsRouter());
  app.use("/api/rbac", createRbacRouter());

  if (openApiEnabled ?? e.OPENAPI_ENABLED !== false) mountApiDocs(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
