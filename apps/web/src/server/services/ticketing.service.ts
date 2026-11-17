/**
 * Binding `apps/web` → `@tfn/ticketing`.
 *
 * Semua call site web tetap memakai path lama (`@/server/services/ticketing.service`) supaya
 * pemindahan paket tidak memaksa refactor 13 file sekaligus. File ini **bukan** salinan logika:
 * ia hanya mengurung dependensi web (prisma, crypto, AUTH_SECRET) lalu meneruskannya ke paket.
 *
 * Jangan menambah logika bisnis di sini. Kalau butuh perilaku baru, tambahkan di
 * `packages/ticketing` dan ekspos lewat binding ini.
 */
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { randomToken, sha256Hex } from "@/lib/security/crypto";
import {
  MAX_TICKETS_PER_ORDER,
  MAX_TICKETS_PER_BUYER_PER_CATEGORY,
  ticketOrderInputSchema,
  ticketTypeInputSchema,
  TicketingError,
  createGuestOrder as createGuestOrderDomain,
  getGuestOrder as getGuestOrderDomain,
  getTicketArtifact as getTicketArtifactDomain,
  confirmOrder as confirmOrderDomain,
  rejectOrder as rejectOrderDomain,
  checkInTicket as checkInTicketDomain,
  expireStaleHolds as expireStaleHoldsDomain,
  listPublishedTicketEvents as listPublishedTicketEventsDomain,
  getPublishedTicketEvent as getPublishedTicketEventDomain,
  type CheckInMethod,
  type CheckInResult,
  type HoldExpirySummary,
  type TicketArtifact,
  type TicketOrderInput,
  type TicketingDeps,
} from "@tfn/ticketing";

export {
  MAX_TICKETS_PER_ORDER,
  MAX_TICKETS_PER_BUYER_PER_CATEGORY,
  ticketOrderInputSchema,
  ticketTypeInputSchema,
  TicketingError,
  type CheckInMethod,
  type CheckInResult,
  type HoldExpirySummary,
  type TicketArtifact,
  type TicketOrderInput,
};

export { CHECK_IN_MAX_INPUT_LENGTH, HOLD_EXPIRY_DEFAULT_HOURS, HOLD_EXPIRY_MAX_BATCH } from "@tfn/ticketing";

/**
 * `AUTH_SECRET` dan `db` dibaca di sini, sekali, lalu dipakai ulang.
 * `db` bisa ditimpa per-call (argumen terakhir) agar tes bisa menyuntikkan transaksi.
 */
export function webTicketingDeps(db: TicketingDeps["db"] = prisma): TicketingDeps {
  return { db, ticketSecret: env().AUTH_SECRET, randomToken, sha256Hex };
}

export const listPublishedTicketEvents = (now = new Date()) => listPublishedTicketEventsDomain(webTicketingDeps(), now);

export const getPublishedTicketEvent = (eventId: string, now = new Date()) =>
  getPublishedTicketEventDomain(webTicketingDeps(), eventId, now);

export const createGuestOrder = (input: TicketOrderInput, db?: TicketingDeps["db"]) =>
  db === undefined ? createGuestOrderDomain(webTicketingDeps(), input) : createGuestOrderDomain(webTicketingDeps(db), input, db);

export const confirmOrder = (orderId: string, actorId: string, db?: TicketingDeps["db"]) =>
  db === undefined ? confirmOrderDomain(webTicketingDeps(), orderId, actorId) : confirmOrderDomain(webTicketingDeps(db), orderId, actorId, db);

export const rejectOrder = (orderId: string, actorId: string, reason: string, db?: TicketingDeps["db"]) =>
  db === undefined ? rejectOrderDomain(webTicketingDeps(), orderId, actorId, reason) : rejectOrderDomain(webTicketingDeps(db), orderId, actorId, reason, db);

export const getGuestOrder = (orderNumberValue: string, capabilityToken: string) =>
  getGuestOrderDomain(webTicketingDeps(), orderNumberValue, capabilityToken);

export const getTicketArtifact = (orderNumberValue: string, capabilityToken: string) =>
  getTicketArtifactDomain(webTicketingDeps(), orderNumberValue, capabilityToken);

export const checkInTicket = (
  input: { raw: string; operatorId: string; eventId?: string | null; now?: Date },
  db?: TicketingDeps["db"],
) => (db === undefined ? checkInTicketDomain(webTicketingDeps(), input) : checkInTicketDomain(webTicketingDeps(db), input, db));

export const expireStaleHolds = (
  options: { olderThanHours?: number; now?: Date; limit?: number; actorId?: string | null } = {},
  db?: TicketingDeps["db"],
) => (db === undefined ? expireStaleHoldsDomain(webTicketingDeps(), options) : expireStaleHoldsDomain(webTicketingDeps(db), options, db));
