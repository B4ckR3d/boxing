/**
 * Onsite gate check-in — real database.
 *
 *   MYSQL_DATABASE=tfn_test npx vitest run --project integration
 *
 * Covers the four things a gate actually gets wrong: a real ticket is refused, a used ticket is
 * admitted twice, a ticket for another night is admitted, and nobody can tell who let them in.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { buildTicketPayload } from "@/lib/ticketing/ticket-token";
import { checkInTicket, confirmOrder, createGuestOrder, rejectOrder, TicketingError } from "@/server/services/ticketing.service";

const PREFIX = "scan-";
let eventId = "";
let otherEventId = "";
let adminId = "";
let secondAdminId = "";
let tribunId = "";
let otherEventTribunId = "";

async function newOrder(qty = 2, ticketTypeId = tribunId, event = eventId, email = "scan@example.com") {
  const created = await createGuestOrder({
    eventId: event,
    ticketTypeId,
    quantity: qty,
    customerName: "Scan Tester",
    customerEmail: email,
    customerPhone: "0812 0000 1111",
    paymentMethod: "BANK_TRANSFER",
    reference: "SCAN-TRX",
  });
  return created.order;
}

async function confirmedOrder(qty = 2, event = eventId, ticketTypeId = tribunId, email = "scan@example.com") {
  const order = await newOrder(qty, ticketTypeId, event, email);
  await confirmOrder(order.id, adminId);
  return order;
}

const qrFor = (orderNumber: string) => buildTicketPayload(orderNumber, env().AUTH_SECRET);

async function expectTicketingError(promise: Promise<unknown>, code: string) {
  let caught: unknown = null;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TicketingError);
  expect((caught as TicketingError).code).toBe(code);
  return caught as TicketingError;
}

beforeAll(async () => {
  adminId = (await prisma.user.create({ data: { email: `${PREFIX}admin@example.com`, name: "Gate Admin", passwordHash: "x", isActive: true } })).id;
  secondAdminId = (await prisma.user.create({ data: { email: `${PREFIX}admin2@example.com`, name: "Gate Admin 2", passwordHash: "x", isActive: true } })).id;

  eventId = (
    await prisma.event.create({
      data: { name: `${PREFIX}Night`, slug: `${PREFIX}night`, venue: "Arena", city: "Temanggung", startsAt: new Date(Date.now() + 30 * 24 * 3600_000), status: "SCHEDULED", isPublished: true },
    })
  ).id;
  otherEventId = (
    await prisma.event.create({
      data: { name: `${PREFIX}Other`, slug: `${PREFIX}other`, venue: "Arena 2", city: "Temanggung", startsAt: new Date(Date.now() + 30 * 24 * 3600_000), status: "SCHEDULED", isPublished: true },
    })
  ).id;

  tribunId = (await prisma.ticketType.create({ data: { eventId, name: "Tribun", code: "scan-tribun", price: 100000, quota: 500 } })).id;
  otherEventTribunId = (await prisma.ticketType.create({ data: { eventId: otherEventId, name: "Tribun", code: "scan-tribun", price: 100000, quota: 500 } })).id;
});

afterAll(async () => {
  for (const id of [eventId, otherEventId]) {
    const ids = (await prisma.ticketOrder.findMany({ where: { eventId: id }, select: { id: true } })).map((o) => o.id);
    if (ids.length) await prisma.auditLog.deleteMany({ where: { entityType: "TicketOrder", entityId: { in: ids } } });
    await prisma.ticketOrder.deleteMany({ where: { eventId: id } });
    await prisma.ticketType.deleteMany({ where: { eventId: id } });
    await prisma.event.deleteMany({ where: { id } });
  }
  await prisma.user.deleteMany({ where: { id: { in: [adminId, secondAdminId] } } });
  await prisma.$disconnect();
});

describe("gate check-in", () => {
  it("admits a signed QR once and flips CONFIRMED → USED with operator + timestamp", async () => {
    const order = await confirmedOrder(3);
    const at = new Date("2026-11-14T12:30:00.000Z");

    const result = await checkInTicket({ raw: qrFor(order.orderNumber), operatorId: adminId, now: at });

    expect(result.orderNumber).toBe(order.orderNumber);
    expect(result.method).toBe("QR");
    expect(result.seats).toBe(3);
    expect(result.categories).toEqual([{ name: "Tribun", quantity: 3 }]);
    expect(result.checkedInAt).toEqual(at);

    const stored = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe("USED");
    expect(stored.checkedInById).toBe(adminId);
    expect(stored.checkedInAt).toEqual(at);
  });

  it("writes an audit entry naming the operator, the method and the seat count", async () => {
    const order = await confirmedOrder(2, eventId, tribunId, "audit@example.com");
    await checkInTicket({ raw: qrFor(order.orderNumber), operatorId: adminId });

    const logs = await prisma.auditLog.findMany({ where: { entityType: "TicketOrder", entityId: order.id, action: "TICKET_CHECKED_IN" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.actorId).toBe(adminId);
    expect(logs[0]!.metadata).toMatchObject({ orderNumber: order.orderNumber, seats: 2, method: "QR", signatureVerified: true });
  });

  it("refuses a second scan and says when the first one happened — without changing the record", async () => {
    const order = await confirmedOrder(1, eventId, tribunId, "double@example.com");
    const first = new Date("2026-11-14T12:00:00.000Z");
    await checkInTicket({ raw: qrFor(order.orderNumber), operatorId: adminId, now: first });

    const error = await expectTicketingError(checkInTicket({ raw: qrFor(order.orderNumber), operatorId: secondAdminId }), "ALREADY_USED");
    expect(error.message).toContain("sudah dipakai");
    expect(error.message).toContain("dua kali");

    const stored = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } });
    // The original operator keeps the credit; the rejected second scan must not overwrite it.
    expect(stored.checkedInById).toBe(adminId);
    expect(stored.checkedInAt).toEqual(first);
    // A refused scan is not an admission, so it must not add a check-in audit row.
    const logs = await prisma.auditLog.count({ where: { entityId: order.id, action: "TICKET_CHECKED_IN" } });
    expect(logs).toBe(1);
  });

  it("admits only one of two simultaneous scans of the same ticket", async () => {
    const order = await confirmedOrder(1, eventId, tribunId, "race@example.com");
    const payload = qrFor(order.orderNumber);

    const results = await Promise.allSettled([
      checkInTicket({ raw: payload, operatorId: adminId }),
      checkInTicket({ raw: payload, operatorId: secondAdminId }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0]!.reason as TicketingError).code).toBe("ALREADY_USED");
    expect(await prisma.auditLog.count({ where: { entityId: order.id, action: "TICKET_CHECKED_IN" } })).toBe(1);
  });

  it("rejects a forged or unknown QR with one message that reveals nothing", async () => {
    const order = await confirmedOrder(1, eventId, tribunId, "forge@example.com");
    const forgedPayload = `TFN1.${order.orderNumber}.deadbeefdead`;

    const forged = await expectTicketingError(checkInTicket({ raw: forgedPayload, operatorId: adminId }), "INVALID_TICKET");
    const unknown = await expectTicketingError(checkInTicket({ raw: "TFN-000000-ZZZZZZ", operatorId: adminId }), "INVALID_TICKET");
    // Same sentence for "your signature is wrong" and "this order does not exist".
    expect(forged.message).toBe(unknown.message);

    expect((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CONFIRMED");
  });

  it("rejects blank and unconfirmed input", async () => {
    // Blank input fails schema validation before any lookup happens.
    await expect(checkInTicket({ raw: "   ", operatorId: adminId })).rejects.toThrow();

    const pending = await newOrder(1, tribunId, eventId, "pending@example.com");
    const error = await expectTicketingError(checkInTicket({ raw: pending.orderNumber, operatorId: adminId }), "NOT_CONFIRMED");
    expect(error.message).toContain("belum dikonfirmasi");
    expect((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("PENDING_CONFIRMATION");
  });

  it("rejects a rejected order", async () => {
    const order = await newOrder(1, tribunId, eventId, "rejected@example.com");
    await rejectOrder(order.id, adminId, "Bukti transfer tidak valid");
    await expectTicketingError(checkInTicket({ raw: order.orderNumber, operatorId: adminId }), "INVALID_STATE");
  });

  it("scopes the gate to one event so a ticket for another night is refused by name", async () => {
    const other = await confirmedOrder(1, otherEventId, otherEventTribunId, "otherevent@example.com");
    const error = await expectTicketingError(
      checkInTicket({ raw: qrFor(other.orderNumber), operatorId: adminId, eventId }),
      "WRONG_EVENT",
    );
    expect(error.message).toContain(`${PREFIX}Other`);
    expect((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("CONFIRMED");

    // The same ticket is valid at its own gate.
    await expect(checkInTicket({ raw: qrFor(other.orderNumber), operatorId: adminId, eventId: otherEventId })).resolves.toMatchObject({ seats: 1 });
  });

  it("falls back to manual order-number entry, audited as such", async () => {
    const order = await confirmedOrder(1, eventId, tribunId, "manual@example.com");
    const result = await checkInTicket({ raw: order.orderNumber.toLowerCase(), operatorId: adminId });

    expect(result.method).toBe("MANUAL");
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: order.id, action: "TICKET_CHECKED_IN" } });
    expect(log.metadata).toMatchObject({ method: "MANUAL", signatureVerified: false });
  });
});
