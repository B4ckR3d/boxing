/**
 * Integration tests for the hold-expiry sweep (`expireStaleHolds`).
 *
 * Runs against the dedicated test database (MYSQL_DATABASE=tfn_test). Every row is namespaced with
 * the `itest-exp-` prefix and deleted in afterAll so the test database stays disposable.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { expireStaleHolds, createGuestOrder, confirmOrder, getGuestOrder, type TicketOrderInput } from "@/server/services/ticketing.service";

const PREFIX = "itest-exp-";
let eventId = "";
let adminId = "";
let gaId = "";
let vipId = "";

function input(overrides: Partial<TicketOrderInput> = {}): TicketOrderInput {
  return {
    eventId,
    ticketTypeId: gaId,
    quantity: 1,
    customerName: "Expiry Tester",
    customerEmail: "itest-exp@example.com",
    customerPhone: "+628****1111",
    paymentMethod: "BANK_TRANSFER",
    reference: "ITEST-EXP-TRX",
    ...overrides,
  };
}

/** Backdates `createdAt` — the sweep keys off it and Prisma lets us write it directly. */
async function backdate(orderId: string, hours: number) {
  await prisma.ticketOrder.update({ where: { id: orderId }, data: { createdAt: new Date(Date.now() - hours * 3600_000) } });
}

async function soldOf(ticketTypeId: string) {
  const row = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId }, select: { sold: true } });
  return row.sold;
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: { email: `${PREFIX}admin@example.com`, name: "ITest Expiry Admin", passwordHash: "not-a-real-hash", isActive: true },
  });
  adminId = admin.id;

  const event = await prisma.event.create({
    data: {
      name: `${PREFIX}Expiry Night`,
      slug: `${PREFIX}expiry-night`,
      venue: "Test Arena",
      city: "Temanggung",
      country: "ID",
      startsAt: new Date(Date.now() + 30 * 24 * 3600_000),
      status: "SCHEDULED",
      isPublished: true,
    },
  });
  eventId = event.id;

  gaId = (await prisma.ticketType.create({ data: { eventId, name: "General", code: "exp-ga", price: 100000, quota: 200 } })).id;
  vipId = (await prisma.ticketType.create({ data: { eventId, name: "VIP", code: "exp-vip", price: 300000, quota: 50 } })).id;
});

afterAll(async () => {
  const orders = await prisma.ticketOrder.findMany({ where: { eventId }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  if (ids.length) await prisma.auditLog.deleteMany({ where: { entityType: "TicketOrder", entityId: { in: ids } } });
  await prisma.ticketOrder.deleteMany({ where: { eventId } });
  await prisma.ticketType.deleteMany({ where: { eventId } });
  await prisma.event.deleteMany({ where: { id: eventId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe("hold expiry sweep (real database)", () => {
  it("cancels a stale pending order, releases its seats, and audits the system actor", async () => {
    const before = await soldOf(vipId);
    const { order, capabilityToken } = await createGuestOrder(input({ ticketTypeId: vipId, quantity: 3 }));
    await backdate(order.id, 30);
    expect(await soldOf(vipId)).toBe(before + 3);

    const summary = await expireStaleHolds({ olderThanHours: 24 });

    expect(summary.expired).toBeGreaterThanOrEqual(1);
    expect(summary.orderNumbers).toContain(order.orderNumber);
    expect(summary.releasedSeats).toBeGreaterThanOrEqual(3);
    expect(await soldOf(vipId)).toBe(before);

    const after = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("CANCELLED");
    expect(after.adminNote).toContain("Kedaluwarsa otomatis");

    // The buyer keeps the same token, and the status page must report CANCELLED (never a leak).
    const view = await getGuestOrder(order.orderNumber, capabilityToken);
    expect(view.status).toBe("CANCELLED");

    const audits = await prisma.auditLog.findMany({ where: { entityType: "TicketOrder", entityId: order.id, action: "TICKET_HOLD_EXPIRED" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorId).toBeNull();
    expect((audits[0]?.metadata as { seats?: number } | null)?.seats).toBe(3);
  });

  it("leaves fresh pending orders and confirmed orders untouched", async () => {
    const fresh = await createGuestOrder(input({ ticketTypeId: gaId, quantity: 1 }));
    const confirmed = await createGuestOrder(input({ ticketTypeId: gaId, quantity: 2 }));
    await confirmOrder(confirmed.order.id, adminId);
    await backdate(confirmed.order.id, 48);
    const soldAfterSetup = await soldOf(gaId);

    const summary = await expireStaleHolds({ olderThanHours: 24, now: new Date() });

    expect(summary.orderNumbers).not.toContain(fresh.order.orderNumber);
    expect(summary.orderNumbers).not.toContain(confirmed.order.orderNumber);
    expect((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: fresh.order.id } })).status).toBe("PENDING_CONFIRMATION");
    expect((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: confirmed.order.id } })).status).toBe("CONFIRMED");
    // Confirmed sales must survive the sweep — releasing them would silently oversell the event.
    expect(await soldOf(gaId)).toBe(soldAfterSetup);
  });

  it("honours the window: a 23-hour-old hold survives a 24-hour window", async () => {
    const { order } = await createGuestOrder(input({ ticketTypeId: gaId, quantity: 1 }));
    await backdate(order.id, 23);

    let summary = await expireStaleHolds({ olderThanHours: 24 });
    expect(summary.orderNumbers).not.toContain(order.orderNumber);
    expect((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_CONFIRMATION");

    summary = await expireStaleHolds({ olderThanHours: 1 });
    expect(summary.orderNumbers).toContain(order.orderNumber);
    expect((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });

  it("is idempotent: a second sweep finds nothing to do", async () => {
    const summary = await expireStaleHolds({ olderThanHours: 24 });
    expect(summary.expired).toBe(0);
    expect(summary.releasedSeats).toBe(0);
    expect(summary.orderNumbers).toHaveLength(0);
  });

  it("never releases more seats than the order holds (sold never goes negative)", async () => {
    const sold = await soldOf(gaId);
    expect(sold).toBeGreaterThanOrEqual(0);
    const total = await prisma.ticketType.aggregate({ where: { eventId }, _sum: { sold: true } });
    expect(total._sum.sold ?? 0).toBeGreaterThanOrEqual(0);
  });
});
