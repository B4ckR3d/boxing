/**
 * Binding `apps/api` → `@tfn/ticketing`.
 *
 * Sebelumnya router ini mengimpor `@/server/services/ticketing.service`, dan alias `@/*` di
 * `apps/api/tsconfig.json` menunjuk ke `../web/src/*`. Itu berarti API tidak bisa di-build atau
 * di-deploy tanpa source web — arah dependensi yang terbalik.
 *
 * Sekarang dependensi disediakan di sini:
 *   - `db`         → Prisma client milik API (`../db/prisma.js`), satu pool per proses
 *   - `ticketSecret` → `env().AUTH_SECRET` milik API, bukan web
 *   - kripto       → implementasi Node murni, byte-identik dengan `@/lib/security/crypto` web
 *                    (`randomBytes(...).toString("base64url")` dan `createHash("sha256")`)
 *
 * Jangan menambah logika bisnis di file ini.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import {
  checkInTicket as checkInTicketDomain,
  confirmOrder as confirmOrderDomain,
  createGuestOrder as createGuestOrderDomain,
  expireStaleHolds as expireStaleHoldsDomain,
  getGuestOrder as getGuestOrderDomain,
  getPublishedTicketEvent as getPublishedTicketEventDomain,
  getTicketArtifact as getTicketArtifactDomain,
  listPublishedTicketEvents as listPublishedTicketEventsDomain,
  rejectOrder as rejectOrderDomain,
  type TicketOrderInput,
  type TicketingDeps,
} from "@tfn/ticketing";

const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");
const sha256Hex = (input: string | Buffer): string => createHash("sha256").update(input).digest("hex");

export function apiTicketingDeps(): TicketingDeps {
  return { db: prisma, ticketSecret: env().AUTH_SECRET, randomToken, sha256Hex };
}

export const listPublishedTicketEvents = (now = new Date()) => listPublishedTicketEventsDomain(apiTicketingDeps(), now);

export const getPublishedTicketEvent = (eventId: string, now = new Date()) =>
  getPublishedTicketEventDomain(apiTicketingDeps(), eventId, now);

export const createGuestOrder = (input: TicketOrderInput) => createGuestOrderDomain(apiTicketingDeps(), input);

export const confirmOrder = (orderId: string, actorId: string) => confirmOrderDomain(apiTicketingDeps(), orderId, actorId);

export const rejectOrder = (orderId: string, actorId: string, reason: string) =>
  rejectOrderDomain(apiTicketingDeps(), orderId, actorId, reason);

export const getGuestOrder = (orderNumber: string, capabilityToken: string) =>
  getGuestOrderDomain(apiTicketingDeps(), orderNumber, capabilityToken);

export const getTicketArtifact = (orderNumber: string, capabilityToken: string) =>
  getTicketArtifactDomain(apiTicketingDeps(), orderNumber, capabilityToken);

export const checkInTicket = (input: { raw: string; operatorId: string; eventId?: string | null; now?: Date }) =>
  checkInTicketDomain(apiTicketingDeps(), input);

export const expireStaleHolds = (options: { olderThanHours?: number; now?: Date; limit?: number; actorId?: string | null } = {}) =>
  expireStaleHoldsDomain(apiTicketingDeps(), options);

export { ticketOrderInputSchema, TicketingError } from "@tfn/ticketing";
