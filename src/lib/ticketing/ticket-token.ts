/**
 * Signed payload carried inside the ticket QR code.
 *
 * Format: `TFN1.<ORDER_NUMBER>.<SIG>` — uppercase alphanumeric so a QR scanner can use the
 * compact alphanumeric mode. The signature is an HMAC-SHA256 over the order number, truncated
 * to 48 bits: enough that forging a ticket for a given order number requires the secret, while
 * staying short enough to read/type manually when a scanner fails at the gate.
 *
 * Verification is offline: the gate only needs the payload and the same secret — no database
 * lookup and no network. The caller then decides whether the order is CONFIRMED and unused.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const TICKET_PAYLOAD_PREFIX = "TFN1";
const SIG_LENGTH = 12;

function sign(orderNumber: string, secret: string): string {
  return createHmac("sha256", secret).update(`${TICKET_PAYLOAD_PREFIX}|${orderNumber}`).digest("hex").slice(0, SIG_LENGTH).toUpperCase();
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Builds the QR payload for a confirmed order. Throws when the secret is missing or too weak. */
export function buildTicketPayload(orderNumber: string, secret: string): string {
  if (!secret || secret.length < 16) throw new Error("TICKET_PAYLOAD_SECRET terlalu pendek");
  const normalized = orderNumber.trim().toUpperCase();
  if (!normalized) throw new Error("Nomor pesanan kosong");
  return `${TICKET_PAYLOAD_PREFIX}.${normalized}.${sign(normalized, secret)}`;
}

/** Returns the embedded order number when the signature matches, otherwise null. Never throws on junk. */
export function verifyTicketPayload(payload: string | null | undefined, secret: string): { orderNumber: string } | null {
  if (!payload || !secret || secret.length < 16) return null;
  const parts = payload.trim().toUpperCase().split(".");
  if (parts.length !== 3) return null;
  const [prefix, orderNumber, signature] = parts as [string, string, string];
  if (prefix !== TICKET_PAYLOAD_PREFIX) return null;
  if (!orderNumber || signature.length !== SIG_LENGTH) return null;
  return safeEqual(signature, sign(orderNumber, secret)) ? { orderNumber } : null;
}
