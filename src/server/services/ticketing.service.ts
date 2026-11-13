import "server-only";
import { z } from "zod";
import { randomToken, sha256Hex } from "@/lib/security/crypto";
import { env } from "@/lib/env";
import { prisma, type Db } from "@/lib/db/prisma";
import { buildTicketPayload, verifyTicketPayload } from "@/lib/ticketing/ticket-token";
import { sameEmail, samePhone } from "@/lib/ticketing/buyer-identity";
import { buildTicketPdf } from "@/server/services/ticket-pdf.service";
import { TicketOrderStatus, TicketPaymentMethod, TicketPaymentStatus } from "@/generated/prisma/enums";

export const MAX_TICKETS_PER_ORDER = 10;
export const ticketTypeInputSchema = z.object({
  eventId: z.string().min(1), name: z.string().trim().min(1).max(100), code: z.string().trim().regex(/^[a-z0-9_-]+$/i).max(40),
  description: z.string().trim().max(500).optional(), price: z.coerce.number().finite().min(0).max(1_000_000_000), quota: z.coerce.number().int().min(1).max(1_000_000), isActive: z.boolean().optional(),
});
export const ticketOrderInputSchema = z.object({
  eventId: z.string().min(1), ticketTypeId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(MAX_TICKETS_PER_ORDER),
  customerName: z.string().trim().min(2).max(120), customerEmail: z.string().trim().email().max(191), customerPhone: z.string().trim().min(5).max(40),
  paymentMethod: z.nativeEnum(TicketPaymentMethod).default(TicketPaymentMethod.BANK_TRANSFER), reference: z.string().trim().max(120).optional(), note: z.string().trim().max(500).optional(),
});
export type TicketOrderInput = z.infer<typeof ticketOrderInputSchema>;
export class TicketingError extends Error { constructor(message: string, public code = "TICKETING_ERROR") { super(message); } }

function orderNumber() { return `TFN-${Date.now().toString(36).toUpperCase()}-${randomToken(5).toUpperCase()}`.slice(0, 32); }
function money(value: unknown): number { return Number(value); }
function ensureFutureEvent(event: { isPublished: boolean; status: string; startsAt: Date }) {
  if (!event.isPublished || event.status !== "SCHEDULED" || event.startsAt <= new Date()) throw new TicketingError("Tiket hanya tersedia untuk event terjadwal yang dipublikasikan", "EVENT_UNAVAILABLE");
}

/**
 * Cap per buyer per ticket category, counted across repeated orders.
 *
 * `MAX_TICKETS_PER_ORDER` already limits a single order; without this cap a scalper just opens ten
 * orders of ten. Counted statuses are the ones that still hold seats: `PENDING_CONFIRMATION`
 * (unconfirmed hold) and `CONFIRMED`. `REJECTED` / `CANCELLED` orders released their seats and must
 * not count against the buyer.
 *
 * Trade-off: the check is read-then-write inside the same transaction, so two simultaneous requests
 * from the same buyer can both pass. For a manually-confirmed flow that is acceptable — the admin
 * still sees two orders and can reject one. Tightening it would need a `SELECT … FOR UPDATE` on a
 * per-buyer row (no such row exists today).
 */
export const MAX_TICKETS_PER_BUYER_PER_CATEGORY = 10;

async function assertBuyerCap(
  db: Db,
  input: { eventId: string; ticketTypeId: string; quantity: number; customerEmail: string; customerPhone: string; ticketTypeName: string },
): Promise<void> {
  const existing = await db.ticketOrderItem.findMany({
    where: {
      ticketTypeId: input.ticketTypeId,
      order: {
        eventId: input.eventId,
        status: { in: [TicketOrderStatus.PENDING_CONFIRMATION, TicketOrderStatus.CONFIRMED] },
      },
    },
    select: { quantity: true, order: { select: { customerEmail: true, customerPhone: true } } },
  });

  const alreadyClaimed = existing.reduce((sum, row) => {
    const sameBuyer = sameEmail(row.order.customerEmail, input.customerEmail) || samePhone(row.order.customerPhone, input.customerPhone);
    return sameBuyer ? sum + row.quantity : sum;
  }, 0);

  if (alreadyClaimed + input.quantity > MAX_TICKETS_PER_BUYER_PER_CATEGORY) {
    throw new TicketingError(
      `Batas pembelian ${MAX_TICKETS_PER_BUYER_PER_CATEGORY} tiket per pembeli untuk kategori ${input.ticketTypeName}. ` +
        `Anda sudah memesan ${alreadyClaimed} tiket. Hubungi admin untuk pembelian tambahan.`,
      "PURCHASE_LIMIT",
    );
  }
}

export async function listPublishedTicketEvents(now = new Date()) {
  return prisma.event.findMany({ where: { isPublished: true, status: "SCHEDULED", startsAt: { gt: now } }, include: { ticketTypes: { where: { isActive: true }, orderBy: { price: "asc" } } }, orderBy: { startsAt: "asc" } });
}
export async function getPublishedTicketEvent(eventId: string, now = new Date()) {
  const event = await prisma.event.findFirst({ where: { id: eventId, isPublished: true, status: "SCHEDULED", startsAt: { gt: now } }, include: { ticketTypes: { where: { isActive: true }, orderBy: { price: "asc" } } } });
  return event;
}

export async function createGuestOrder(input: TicketOrderInput, db: Db = prisma) {
  const parsed = ticketOrderInputSchema.parse(input);
  const token = randomToken(32);
  const tokenHash = sha256Hex(token);
  return db.$transaction(async (tx) => {
    const type = await tx.ticketType.findUnique({ where: { id: parsed.ticketTypeId }, include: { event: true } });
    if (!type || type.eventId !== parsed.eventId || !type.isActive) throw new TicketingError("Kategori tiket tidak tersedia", "TICKET_UNAVAILABLE");
    ensureFutureEvent(type.event);
    await assertBuyerCap(tx, {
      eventId: parsed.eventId,
      ticketTypeId: type.id,
      quantity: parsed.quantity,
      customerEmail: parsed.customerEmail,
      customerPhone: parsed.customerPhone,
      ticketTypeName: type.name,
    });
    // Atomic guarded reservation: sold includes pending holds and confirmed orders.
    const reserved = await tx.ticketType.updateMany({ where: { id: type.id, isActive: true, sold: { lte: type.quota - parsed.quantity } }, data: { sold: { increment: parsed.quantity } } });
    if (reserved.count !== 1) throw new TicketingError("Kuota tiket tidak mencukupi", "SOLD_OUT");
    const subtotal = money(type.price) * parsed.quantity;
    const order = await tx.ticketOrder.create({ data: { orderNumber: orderNumber(), guestTokenHash: tokenHash, eventId: parsed.eventId, customerName: parsed.customerName, customerEmail: parsed.customerEmail, customerPhone: parsed.customerPhone, totalAmount: subtotal, paymentMethod: parsed.paymentMethod, paymentStatus: parsed.reference ? TicketPaymentStatus.PROOF_SUBMITTED : TicketPaymentStatus.UNPAID, customerNote: parsed.note, items: { create: { ticketTypeId: type.id, quantity: parsed.quantity, unitPrice: type.price, subtotal } }, payment: { create: { amount: subtotal, method: parsed.paymentMethod, status: parsed.reference ? TicketPaymentStatus.PROOF_SUBMITTED : TicketPaymentStatus.UNPAID, reference: parsed.reference ?? null, note: parsed.note ?? null } } } });
    await tx.auditLog.create({ data: { actorId: null, action: "TICKET_ORDER_CREATED", entityType: "TicketOrder", entityId: order.id, summary: "Guest ticket order created", metadata: { quantity: parsed.quantity, eventId: parsed.eventId, ticketTypeId: type.id } } });
    return { order, capabilityToken: token };
  });
}

export async function confirmOrder(orderId: string, actorId: string, db: Db = prisma) {
  return db.$transaction(async (tx) => {
    const order = await tx.ticketOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new TicketingError("Pesanan tidak ditemukan", "NOT_FOUND");
    if (order.status === TicketOrderStatus.CONFIRMED) return order;
    if (order.status !== TicketOrderStatus.PENDING_CONFIRMATION) throw new TicketingError("Pesanan tidak dapat dikonfirmasi", "INVALID_STATE");
    const changed = await tx.ticketOrder.updateMany({ where: { id: orderId, status: TicketOrderStatus.PENDING_CONFIRMATION }, data: { status: TicketOrderStatus.CONFIRMED, confirmedById: actorId, confirmedAt: new Date() } });
    if (changed.count !== 1) return (await tx.ticketOrder.findUniqueOrThrow({ where: { id: orderId } }));
    await tx.ticketPayment.update({ where: { orderId }, data: { status: TicketPaymentStatus.VERIFIED, reviewedById: actorId, reviewedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId, action: "TICKET_ORDER_CONFIRMED", entityType: "TicketOrder", entityId: orderId, summary: "Ticket order confirmed" } });
    return tx.ticketOrder.findUniqueOrThrow({ where: { id: orderId } });
  });
}

export async function rejectOrder(orderId: string, actorId: string, reason: string, db: Db = prisma) {
  const cleanReason = z.string().trim().min(1).max(500).parse(reason);
  return db.$transaction(async (tx) => {
    const order = await tx.ticketOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new TicketingError("Pesanan tidak ditemukan", "NOT_FOUND");
    if (order.status === TicketOrderStatus.REJECTED) return order;
    if (order.status !== TicketOrderStatus.PENDING_CONFIRMATION) throw new TicketingError("Pesanan tidak dapat ditolak", "INVALID_STATE");
    for (const item of order.items) {
      const released = await tx.ticketType.updateMany({ where: { id: item.ticketTypeId, sold: { gte: item.quantity } }, data: { sold: { decrement: item.quantity } } });
      if (released.count !== 1) throw new TicketingError("Gagal melepaskan kuota", "CAPACITY_ERROR");
    }
    const updated = await tx.ticketOrder.updateMany({ where: { id: orderId, status: TicketOrderStatus.PENDING_CONFIRMATION }, data: { status: TicketOrderStatus.REJECTED, rejectionReason: cleanReason, rejectedAt: new Date() } });
    if (updated.count !== 1) return tx.ticketOrder.findUniqueOrThrow({ where: { id: orderId } });
    await tx.ticketPayment.update({ where: { orderId }, data: { status: TicketPaymentStatus.REJECTED } });
    await tx.auditLog.create({ data: { actorId, action: "TICKET_ORDER_REJECTED", entityType: "TicketOrder", entityId: orderId, summary: "Ticket order rejected", metadata: { reason: cleanReason } } });
    return tx.ticketOrder.findUniqueOrThrow({ where: { id: orderId } });
  });
}

export async function getGuestOrder(orderNumberValue: string, capabilityToken: string) {
  const order = await prisma.ticketOrder.findFirst({ where: { orderNumber: orderNumberValue, guestTokenHash: sha256Hex(capabilityToken) }, include: { event: true, items: { include: { ticketType: true } }, payment: true } });
  if (!order) throw new TicketingError("Pesanan tidak ditemukan", "NOT_FOUND");
  return { id: order.id, orderNumber: order.orderNumber, status: order.status, totalAmount: order.totalAmount, event: { name: order.event.name, startsAt: order.event.startsAt }, items: order.items.map((i) => ({ name: i.ticketType.name, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal })), payment: order.payment ? { status: order.payment.status, method: order.payment.method, reference: order.payment.reference } : null };
}

export type TicketArtifact = {
  filename: string;
  buffer: Uint8Array;
  /** Signed QR payload, returned so callers/tests can verify it without parsing the PDF. */
  payload: string;
};

/**
 * Renders the entry ticket PDF for a CONFIRMED order.
 *
 * Access is exactly as strict as the status page: the guest capability token must hash to the stored
 * `guestTokenHash`. Pending/rejected/cancelled orders get `INVALID_STATE` — downloading a ticket for
 * an unconfirmed order would let someone at the gate argue they already paid.
 */
export async function getTicketArtifact(orderNumberValue: string, capabilityToken: string): Promise<TicketArtifact> {
  const order = await prisma.ticketOrder.findFirst({
    where: { orderNumber: orderNumberValue, guestTokenHash: sha256Hex(capabilityToken) },
    include: { event: true, items: { include: { ticketType: true } } },
  });
  if (!order) throw new TicketingError("Pesanan tidak ditemukan", "NOT_FOUND");
  // USED is still downloadable: the buyer already walked in, but re-printing their own ticket is harmless.
  if (order.status !== TicketOrderStatus.CONFIRMED && order.status !== TicketOrderStatus.USED) {
    throw new TicketingError("Tiket tersedia setelah admin mengonfirmasi pembayaran Anda", "INVALID_STATE");
  }

  const payload = buildTicketPayload(order.orderNumber, env().AUTH_SECRET);
  const buffer = await buildTicketPdf({
    orderNumber: order.orderNumber,
    buyerName: order.customerName,
    buyerEmail: order.customerEmail,
    eventName: order.event.name,
    venue: order.event.venue ?? "Arena TBC",
    city: order.event.city ?? "Temanggung",
    startsAt: order.event.startsAt,
    items: order.items.map((item) => ({
      name: item.ticketType.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
    })),
    totalAmount: Number(order.totalAmount),
    payload,
  });

  return { filename: `tiket-${order.orderNumber}.pdf`, buffer, payload };
}
/* ------------------------------------------------------------------------------------------------
 * Onsite check-in (gate scanning)
 * ---------------------------------------------------------------------------------------------- */

export type CheckInMethod = "QR" | "MANUAL";

export type CheckInResult = {
  orderNumber: string;
  customerName: string;
  eventName: string;
  venue: string | null;
  seats: number;
  categories: { name: string; quantity: number }[];
  checkedInAt: Date;
  /** `QR` = signed payload verified; `MANUAL` = operator typed the order number. */
  method: CheckInMethod;
};

export const CHECK_IN_MAX_INPUT_LENGTH = 200;

/** One message for every rejection that could tell an attacker why their forgery failed. */
const INVALID_TICKET_MESSAGE = "Tiket tidak valid. Periksa kembali QR tiket atau hubungi admin.";

const jakartaTime = (value: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);

/**
 * Validates a scanned ticket and consumes it (CONFIRMED → USED).
 *
 * Two entry paths, because a gate has two failure modes:
 *   - `raw` is the QR payload `TFN1.<order>.<HMAC>` → signature verified offline first, so a forged
 *     QR never even reaches the database.
 *   - `raw` is a bare order number → accepted as the manual fallback when a phone camera fails.
 *     The operator is authenticated and the attempt is audited as `method: "MANUAL"`.
 *
 * Idempotency: the flip is a guarded `updateMany` on `status = CONFIRMED`, so two operators scanning
 * the same ticket at the same second produce exactly one USED order and one error — never two
 * admissions. `eventId` (optional) scopes the gate to tonight's event and rejects tickets for other
 * nights, which is the mistake ushers actually make.
 */
export async function checkInTicket(
  input: { raw: string; operatorId: string; eventId?: string | null; now?: Date },
  db: Db = prisma,
): Promise<CheckInResult> {
  const raw = z.string().trim().min(1).max(CHECK_IN_MAX_INPUT_LENGTH).parse(input.raw);

  const verified = verifyTicketPayload(raw, env().AUTH_SECRET);
  const orderNumber = (verified?.orderNumber ?? raw).toUpperCase();
  const method: CheckInMethod = verified ? "QR" : "MANUAL";

  // Order numbers are `TFN-<base36>-<base64url>`: base64url brings `_` along, so it must be allowed.
  if (!/^[A-Z0-9_-]{6,32}$/.test(orderNumber)) {
    throw new TicketingError(INVALID_TICKET_MESSAGE, "INVALID_TICKET");
  }

  return db.$transaction(async (tx) => {
    const order = await tx.ticketOrder.findUnique({
      where: { orderNumber },
      include: { event: true, items: { include: { ticketType: true } } },
    });
    // Unknown order and forged QR share one message: no oracle for guessing valid order numbers.
    if (!order) throw new TicketingError(INVALID_TICKET_MESSAGE, "INVALID_TICKET");

    if (input.eventId && order.eventId !== input.eventId) {
      throw new TicketingError(`Tiket ini untuk event lain (${order.event.name}).`, "WRONG_EVENT");
    }

    const seats = order.items.reduce((sum, item) => sum + item.quantity, 0);

    if (order.status === TicketOrderStatus.USED) {
      const when = order.checkedInAt ? jakartaTime(order.checkedInAt) : "sebelumnya";
      throw new TicketingError(`Tiket sudah dipakai pada ${when}. Jangan izinkan masuk dua kali.`, "ALREADY_USED");
    }
    if (order.status === TicketOrderStatus.PENDING_CONFIRMATION) {
      throw new TicketingError("Pesanan belum dikonfirmasi. Minta pembeli menyelesaikan pembayaran.", "NOT_CONFIRMED");
    }
    if (order.status !== TicketOrderStatus.CONFIRMED) {
      throw new TicketingError("Pesanan sudah dibatalkan atau ditolak, tiket tidak berlaku.", "INVALID_STATE");
    }

    const now = input.now ?? new Date();
    const flipped = await tx.ticketOrder.updateMany({
      where: { id: order.id, status: TicketOrderStatus.CONFIRMED },
      data: { status: TicketOrderStatus.USED, checkedInAt: now, checkedInById: input.operatorId },
    });
    // Lost the race against another scanner: report it exactly like a repeated scan.
    if (flipped.count !== 1) {
      throw new TicketingError("Tiket sudah dipakai. Jangan izinkan masuk dua kali.", "ALREADY_USED");
    }

    await tx.auditLog.create({
      data: {
        actorId: input.operatorId,
        action: "TICKET_CHECKED_IN",
        entityType: "TicketOrder",
        entityId: order.id,
        summary: `Ticket checked in at gate (${method})`,
        metadata: { orderNumber, seats, eventId: order.eventId, method, signatureVerified: method === "QR" },
      },
    });

    return {
      orderNumber,
      customerName: order.customerName,
      eventName: order.event.name,
      venue: order.event.venue ?? null,
      seats,
      categories: order.items.map((item) => ({ name: item.ticketType.name, quantity: item.quantity })),
      checkedInAt: now,
      method,
    };
  });
}

export const HOLD_EXPIRY_DEFAULT_HOURS = 24;
export const HOLD_EXPIRY_MAX_BATCH = 200;
export type HoldExpirySummary = {
  /** How many stale pending orders the sweep looked at. */
  scanned: number;
  /** Orders flipped to CANCELLED by this run. */
  expired: number;
  /** Orders skipped because an admin resolved them mid-run (no longer pending). */
  skipped: number;
  /** Seats returned to sale (`TicketType.sold` decremented by this amount). */
  releasedSeats: number;
  orderNumbers: string[];
};

/**
 * Releases seats held by unpaid orders that were never resolved.
 *
 * A pending order keeps `TicketType.sold` incremented forever; without this sweep a forgotten order
 * removes seats from sale permanently. Mirrors `rejectOrder` invariants:
 *   - only `PENDING_CONFIRMATION` rows are touched (a concurrent confirm/reject wins and we skip),
 *   - capacity is released with a guarded `sold >= quantity` decrement,
 *   - every expiry writes an audit row naming the system actor.
 *
 * Runs per-order transactions sequentially: one bad row cannot roll back the whole batch.
 * `olderThanHours` is explicit (no env read) so tests can pin the cutoff.
 */
export async function expireStaleHolds(
  options: { olderThanHours?: number; now?: Date; limit?: number; actorId?: string | null } = {},
  db: Db = prisma,
): Promise<HoldExpirySummary> {
  const hours = options.olderThanHours ?? HOLD_EXPIRY_DEFAULT_HOURS;
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(options.limit ?? HOLD_EXPIRY_MAX_BATCH, 1), HOLD_EXPIRY_MAX_BATCH);
  const actorId = options.actorId ?? null;
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const candidates = await db.ticketOrder.findMany({
    where: { status: TicketOrderStatus.PENDING_CONFIRMATION, createdAt: { lt: cutoff } },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const summary: HoldExpirySummary = { scanned: candidates.length, expired: 0, skipped: 0, releasedSeats: 0, orderNumbers: [] };
  if (candidates.length === 0) return summary;

  for (const candidate of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.ticketOrder.findUnique({ where: { id: candidate.id }, include: { items: true } });
      if (!order || order.status !== TicketOrderStatus.PENDING_CONFIRMATION) return { skipped: true as const, seats: 0 };

      for (const item of order.items) {
        const released = await tx.ticketType.updateMany({ where: { id: item.ticketTypeId, sold: { gte: item.quantity } }, data: { sold: { decrement: item.quantity } } });
        if (released.count !== 1) throw new TicketingError("Gagal melepaskan kuota pesanan kedaluwarsa", "CAPACITY_ERROR");
      }

      // Guarded flip: if an admin confirmed/rejected between the scan and now, we must not cancel.
      const flipped = await tx.ticketOrder.updateMany({
        where: { id: order.id, status: TicketOrderStatus.PENDING_CONFIRMATION },
        data: { status: TicketOrderStatus.CANCELLED, adminNote: `Kedaluwarsa otomatis setelah ${hours} jam tanpa konfirmasi` },
      });
      if (flipped.count !== 1) throw new TicketingError("Pesanan berubah status saat kedaluwarsa", "INVALID_STATE");

      await tx.auditLog.create({
        data: {
          actorId,
          action: "TICKET_HOLD_EXPIRED",
          entityType: "TicketOrder",
          entityId: order.id,
          summary: "Pending ticket hold expired and capacity released",
          metadata: { hours, orderNumber: order.orderNumber, seats: order.items.reduce((sum, item) => sum + item.quantity, 0) },
        },
      });
      return { skipped: false as const, seats: order.items.reduce((sum, item) => sum + item.quantity, 0) };
    }).catch((error: unknown) => {
      if (error instanceof TicketingError && (error.code === "INVALID_STATE" || error.code === "NOT_FOUND")) {
        return { skipped: true as const, seats: 0 };
      }
      throw error;
    });

    if (result.skipped) {
      summary.skipped += 1;
    } else {
      summary.expired += 1;
      summary.releasedSeats += result.seats;
      summary.orderNumbers.push(candidate.orderNumber);
    }
  }

  return summary;
}
