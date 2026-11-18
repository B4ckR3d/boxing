import type { Request, Response } from "express";

/** Semua route tak dikenal mengembalikan bentuk error yang sama dengan handler error. */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} tidak ditemukan`,
      requestId: req.requestId,
    },
  });
}
