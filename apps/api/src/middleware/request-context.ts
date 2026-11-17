import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmentasi tipe Express standar
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Request id dipakai untuk korelasi log ↔ response.
 * Nilai dari klien (`x-request-id`) dipakai bila formatnya wajar, selain itu dibuat baru.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
