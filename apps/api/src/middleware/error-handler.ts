import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/**
 * Satu-satunya tempat yang mengubah error menjadi HTTP response.
 * - `AppError`        → status & code sesuai definisi
 * - `ZodError`        → 422 VALIDATION_ERROR + daftar issue
 * - lainnya           → 500 INTERNAL_ERROR (stack hanya masuk log, tidak ke klien)
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response<ErrorBody>,
  _next: NextFunction,
): void {
  const log = logger();

  if (error instanceof AppError) {
    log.warn(
      { requestId: req.requestId, code: error.code, status: error.statusCode, path: req.originalUrl },
      "request failed",
    );
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.expose ? error.message : "Terjadi kesalahan pada server",
        ...(error.details === undefined ? {} : { details: error.details }),
        requestId: req.requestId,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    log.warn(
      { requestId: req.requestId, issues: error.issues.length, path: req.originalUrl },
      "validation failed",
    );
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Data permintaan tidak valid",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
        requestId: req.requestId,
      },
    });
    return;
  }

  log.error({ requestId: req.requestId, err: error, path: req.originalUrl }, "unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server",
      requestId: req.requestId,
    },
  });
}
