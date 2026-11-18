import { Router, type Request } from "express";
import { z } from "zod";
import {
  checkInTicket,
  confirmOrder,
  createGuestOrder,
  getGuestOrder,
  getPublishedTicketEvent,
  getTicketArtifact,
  listPublishedTicketEvents,
  rejectOrder,
  ticketOrderInputSchema,
  TicketingError,
} from "../lib/ticketing.js";
import { rateLimit } from "@tfn/auth/rate-limit";
import { originAllowed, requirePermission } from "../lib/require-permission.js";
import { AppError } from "../lib/errors";
import { env } from "../config/env.js";

/**
 * Router ticketing di `apps/api` (Langkah C).
 *
 * Logika bisnis **tidak diduplikasi**: semuanya memakai `@/server/services/ticketing.service`,
 * sumber yang sama dengan web. Yang berbeda hanya adaptor HTTP:
 *   - cookie sesi  → `createExpressCookieJar(req, res)` (bukan `next/headers`)
 *   - origin check → header request Express (bukan `next/headers`)
 *   - rate limit   → modul yang sama, in-process per instance
 *
 * Kontrak error mengikuti ADR-010 `{ error: { code, message, details?, requestId } }`.
 * `TicketingError` dipetakan ke status HTTP sesuai maknanya — bukan semua jadi 400, karena
 * "tiket habis" (409) dan "pesanan tidak ada" (404) adalah hal berbeda bagi pembeli.
 */

const MUTATION_CONFLICTS = new Set([
  "SOLD_OUT",
  "EVENT_UNAVAILABLE",
  "TICKET_UNAVAILABLE",
  "PURCHASE_LIMIT",
  "INVALID_STATE",
]);

function statusFor(code: string): number {
  if (code === "NOT_FOUND") return 404;
  if (code === "INVALID_TICKET") return 400;
  if (MUTATION_CONFLICTS.has(code)) return 409;
  return 400;
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (first?.split(",")[0]?.trim() || req.ip || "127.0.0.1").slice(0, 64);
}

/** Terjemahkan `TicketingError` ke envelope ADR-010 tanpa membocorkan detail internal. */
function toAppError(error: unknown): AppError {
  if (error instanceof TicketingError) {
    return new AppError(statusFor(error.code), error.code, error.message);
  }
  if (error instanceof z.ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Data pesanan tidak valid.", {
      details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return new AppError(500, "INTERNAL_ERROR", "Pesanan tidak dapat diproses.", { expose: false });
}

const rejectSchema = z.object({ reason: z.string().trim().min(1).max(500) });
const checkInSchema = z.object({
  raw: z.string().trim().min(1).max(200),
  eventId: z.string().trim().min(1).max(64).nullable().optional(),
});

export function createTicketingRouter(): Router {
  const router = Router();

  /** GET /api/ticketing/events — event publik yang sedang menjual tiket. */
  router.get("/events", async (_req, res, next) => {
    try {
      res.json({ data: await listPublishedTicketEvents() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/events/:eventId", async (req, res, next) => {
    try {
      const event = await getPublishedTicketEvent(req.params.eventId ?? "");
      if (!event) throw new AppError(404, "NOT_FOUND", "Event tidak ditemukan");
      res.json({ data: event });
    } catch (error) {
      next(error);
    }
  });

  /** POST /api/ticketing/orders — guest checkout. Rate limit + origin sama seperti di web. */
  router.post("/orders", async (req, res, next) => {
    try {
      if (!originAllowed(req, env().APP_URL)) throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");

      const limited = rateLimit("publicApi", `ticket-order:${clientIp(req)}`);
      if (!limited.allowed) {
        res.setHeader("Retry-After", String(limited.retryAfterSeconds));
        throw new AppError(429, "RATE_LIMITED", "Terlalu banyak permintaan");
      }

      const parsed = ticketOrderInputSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;

      const result = await createGuestOrder(parsed.data);
      res.status(201).json({
        orderNumber: result.order.orderNumber,
        capabilityToken: result.capabilityToken,
        status: result.order.status,
      });
    } catch (error) {
      next(error instanceof TicketingError || error instanceof z.ZodError ? toAppError(error) : error);
    }
  });

  /** GET /api/ticketing/orders/:orderNumber?token= — capability token adalah satu-satunya kredensial. */
  router.get("/orders/:orderNumber", async (req, res, next) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
      if (!token) throw new AppError(401, "TOKEN_REQUIRED", "Token diperlukan");
      res.json({ data: await getGuestOrder(req.params.orderNumber ?? "", token) });
    } catch (error) {
      next(error instanceof TicketingError ? toAppError(error) : error);
    }
  });

  /** GET /api/ticketing/orders/:orderNumber/ticket?token= — PDF, biner. */
  router.get("/orders/:orderNumber/ticket", async (req, res, next) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
      if (!token) throw new AppError(401, "TOKEN_REQUIRED", "Token akses wajib diisi.");

      const { filename, buffer } = await getTicketArtifact(req.params.orderNumber ?? "", token);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(buffer.byteLength));
      res.setHeader("Cache-Control", "private, no-store");
      res.end(Buffer.from(buffer));
    } catch (error) {
      next(error instanceof TicketingError ? toAppError(error) : error);
    }
  });

  /** POST /api/ticketing/orders/:orderId/confirm — butuh `ticketing.confirm`. */
  router.post("/orders/:orderId/confirm", async (req, res, next) => {
    try {
      if (!originAllowed(req, env().APP_URL)) throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
      const user = await requirePermission(req, res, "ticketing.confirm");
      res.json({ data: await confirmOrder(req.params.orderId ?? "", user.id) });
    } catch (error) {
      next(error instanceof TicketingError ? toAppError(error) : error);
    }
  });

  /** POST /api/ticketing/orders/:orderId/reject — butuh `ticketing.confirm`. */
  router.post("/orders/:orderId/reject", async (req, res, next) => {
    try {
      if (!originAllowed(req, env().APP_URL)) throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
      const user = await requirePermission(req, res, "ticketing.confirm");

      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;

      res.json({ data: await rejectOrder(req.params.orderId ?? "", user.id, parsed.data.reason) });
    } catch (error) {
      next(error instanceof TicketingError || error instanceof z.ZodError ? toAppError(error) : error);
    }
  });

  /** POST /api/ticketing/check-in — gate scan. */
  router.post("/check-in", async (req, res, next) => {
    try {
      if (!originAllowed(req, env().APP_URL)) throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
      const user = await requirePermission(req, res, "ticketing.confirm");

      const parsed = checkInSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;

      const result = await checkInTicket({
        raw: parsed.data.raw,
        operatorId: user.id,
        eventId: parsed.data.eventId ?? null,
      });
      res.json({ data: { ...result, checkedInAt: result.checkedInAt.toISOString() } });
    } catch (error) {
      next(error instanceof TicketingError || error instanceof z.ZodError ? toAppError(error) : error);
    }
  });

  return router;
}
