/**
 * Integration tests for the ticketing transaction flow.
 *
 * These tests run against a REAL MySQL/MariaDB database. They must never point
 * at `tfn_local` — use the dedicated test database:
 *
 *   MYSQL_DATABASE=tfn_test npx vitest run --project integration
 *
 * Every record created here is namespaced with the `itest-` prefix and removed
 * in afterAll so the test database stays disposable.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createGuestOrder,
  confirmOrder,
  rejectOrder,
  getGuestOrder,
  TicketingError,
  type TicketOrderInput,
} from "@/server/services/ticketing.service";

const PREFIX = "itest-";
let eventId = "";
let adminId = "";
let vipId = "";
let gaId = "";

function orderInput(overrides: Partial<TicketOrderInput> = {}): TicketOrderInput {
  return {
    eventId,
    ticketTypeId: vipId,
    quantity: 1,
    customerName: "Integration Tester",
    customerEmail: "itest@example.com",
    customerPhone: "+628000000000",
    paymentMethod: "BANK_TRANSFER",
    reference: "ITEST-TRX-1",
    ...overrides,
  };
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      email: `${PREFIX}admin@example.com`,
      name: "ITest Admin",
      passwordHash: "not-a-real-hash",
      isActive: true,
    },
  });
  adminId = admin.id;

  const event = await prisma.event.create({
    data: {
      name: `${PREFIX}Night`,
      slug: `${PREFIX}night`,
      venue: "Test Arena",
      city: "Temanggung",
      country: "ID",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      status: "SCHEDULED",
      isPublished: true,
    },
  });
  eventId = event.id;

  const vip = await prisma.ticketType.create({
    data: { eventId, name: "VIP", code: "vip", price: 250000, quota: 2 },
  });
  vipId = vip.id;

  const ga = await prisma.ticketType.create({
    data: { eventId, name: "General", code: "ga", price: 100000, quota: 100 },
  });
  gaId = ga.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityType: "TicketOrder", entityId: { in: await orderIds() } } });
  await prisma.ticketOrder.deleteMany({ where: { eventId } });
  await prisma.ticketType.deleteMany({ where: { eventId } });
  await prisma.event.deleteMany({ where: { id: eventId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

async function orderIds(): Promise<string[]> {
  if (!eventId) return [];
  const rows = await prisma.ticketOrder.findMany({ where: { eventId }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function soldOf(ticketTypeId: string): Promise<number> {
  const row = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId }, select: { sold: true } });
  return row.sold;
}

describe("ticketing integration (real database)", () => {
  it("reserves quota, snapshots price, and stores only a hashed capability token", async () => {
    const before = await soldOf(gaId);
    const { order, capabilityToken } = await createGuestOrder(
      orderInput({ ticketTypeId: gaId, quantity: 2, reference: undefined })
    );

    expect(order.status).toBe("PENDING_CONFIRMATION");
    expect(Number(order.totalAmount)).toBe(200000);
    expect(order.guestTokenHash).not.toBe(capabilityToken);
    expect(order.guestTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await soldOf(gaId)).toBe(before + 2);

    // Guests can read their own order with the capability token only.
    const view = await getGuestOrder(order.orderNumber, capabilityToken);
    expect(view.orderNumber).toBe(order.orderNumber);
    expect(view.items[0]?.quantity).toBe(2);

    await expect(getGuestOrder(order.orderNumber, "wrong-token")).rejects.toBeInstanceOf(TicketingError);
  });

  it("prevents overselling when concurrent orders race the last seats", async () => {
    // VIP quota is 2 → two concurrent single-seat orders cannot both win.
    const results = await Promise.allSettled([
      createGuestOrder(orderInput({ quantity: 2 })),
      createGuestOrder(orderInput({ quantity: 2 })),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(TicketingError);
    expect(await soldOf(vipId)).toBe(2);
  });

  it("confirms idempotently without double-counting capacity", async () => {
    const { order } = await createGuestOrder(orderInput({ ticketTypeId: gaId, quantity: 1 }));
    const soldBefore = await soldOf(gaId);

    const first = await confirmOrder(order.id, adminId);
    const second = await confirmOrder(order.id, adminId);

    expect(first.status).toBe("CONFIRMED");
    expect(second.status).toBe("CONFIRMED");
    expect(second.confirmedById).toBe(adminId);
    expect(await soldOf(gaId)).toBe(soldBefore);

    const payment = await prisma.ticketPayment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe("VERIFIED");

    const audits = await prisma.auditLog.count({
      where: { entityType: "TicketOrder", entityId: order.id, action: "TICKET_ORDER_CONFIRMED" },
    });
    expect(audits).toBe(1);
  });

  it("rejects an order, releases its capacity, and records the reason", async () => {
    const { order } = await createGuestOrder(orderInput({ ticketTypeId: gaId, quantity: 3 }));
    const soldAfterOrder = await soldOf(gaId);

    const rejected = await rejectOrder(order.id, adminId, "Bukti transfer tidak valid");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Bukti transfer tidak valid");
    expect(await soldOf(gaId)).toBe(soldAfterOrder - 3);

    await expect(rejectOrder(order.id, adminId, "again")).resolves.toMatchObject({ status: "REJECTED" });
    expect(await soldOf(gaId)).toBe(soldAfterOrder - 3);
  });

  it("refuses to confirm an order that was already rejected", async () => {
    const { order } = await createGuestOrder(orderInput({ ticketTypeId: gaId, quantity: 1 }));
    await rejectOrder(order.id, adminId, "Dibatalkan pembeli");
    await expect(confirmOrder(order.id, adminId)).rejects.toBeInstanceOf(TicketingError);
  });

  it("rejects orders for unpublished or past events", async () => {
    await prisma.event.update({ where: { id: eventId }, data: { isPublished: false } });
    await expect(createGuestOrder(orderInput({ ticketTypeId: gaId, quantity: 1 }))).rejects.toBeInstanceOf(TicketingError);

    await prisma.event.update({ where: { id: eventId }, data: { isPublished: true, startsAt: new Date(Date.now() - 3600_000) } });
    await expect(createGuestOrder(orderInput({ ticketTypeId: gaId, quantity: 1 }))).rejects.toBeInstanceOf(TicketingError);

    await prisma.event.update({ where: { id: eventId }, data: { startsAt: new Date(Date.now() + 86400_000) } });
  });
});
