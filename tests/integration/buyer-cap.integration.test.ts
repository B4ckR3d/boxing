/**
 * Per-buyer, per-category purchase cap (anti-scalping) — real database.
 *
 *   MYSQL_DATABASE=tfn_test npx vitest run --project integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { expireStaleHolds, MAX_TICKETS_PER_BUYER_PER_CATEGORY, rejectOrder, createGuestOrder } from "@/server/services/ticketing.service";

const CAP = MAX_TICKETS_PER_BUYER_PER_CATEGORY;
const PREFIX = "cap-";
let eventId = "";
let otherEventId = "";
let adminId = "";
let tribunId = "";
let vipId = "";
let otherEventTribunId = "";

async function order(opts: { ticketTypeId?: string; event?: string; qty: number; email?: string; phone?: string }) {
  return createGuestOrder({
    eventId: opts.event ?? eventId,
    ticketTypeId: opts.ticketTypeId ?? tribunId,
    quantity: opts.qty,
    customerName: "Cap Tester",
    customerEmail: opts.email ?? "cap@example.com",
    customerPhone: opts.phone ?? "0812 3456 7890",
    paymentMethod: "BANK_TRANSFER",
    reference: "CAP-TRX",
  });
}

async function sold(ticketTypeId: string) {
  return (await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } })).sold;
}

beforeAll(async () => {
  adminId = (await prisma.user.create({ data: { email: `${PREFIX}admin@example.com`, name: "Cap Admin", passwordHash: "x", isActive: true } })).id;
  const event = await prisma.event.create({
    data: { name: `${PREFIX}Night`, slug: `${PREFIX}night`, venue: "Arena", city: "Temanggung", startsAt: new Date(Date.now() + 30 * 24 * 3600_000), status: "SCHEDULED", isPublished: true },
  });
  eventId = event.id;
  const other = await prisma.event.create({
    data: { name: `${PREFIX}Other`, slug: `${PREFIX}other`, venue: "Arena 2", city: "Temanggung", startsAt: new Date(Date.now() + 30 * 24 * 3600_000), status: "SCHEDULED", isPublished: true },
  });
  otherEventId = other.id;
  tribunId = (await prisma.ticketType.create({ data: { eventId, name: "Tribun", code: "cap-tribun", price: 100000, quota: 500 } })).id;
  vipId = (await prisma.ticketType.create({ data: { eventId, name: "VIP", code: "cap-vip", price: 400000, quota: 100 } })).id;
  otherEventTribunId = (await prisma.ticketType.create({ data: { eventId: otherEventId, name: "Tribun", code: "cap-tribun", price: 100000, quota: 500 } })).id;
});

afterAll(async () => {
  for (const id of [eventId, otherEventId]) {
    const ids = (await prisma.ticketOrder.findMany({ where: { eventId: id }, select: { id: true } })).map((o) => o.id);
    if (ids.length) await prisma.auditLog.deleteMany({ where: { entityType: "TicketOrder", entityId: { in: ids } } });
    await prisma.ticketOrder.deleteMany({ where: { eventId: id } });
    await prisma.ticketType.deleteMany({ where: { eventId: id } });
    await prisma.event.deleteMany({ where: { id } });
  }
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe("per-buyer per-category cap", () => {
  it(`allows exactly ${CAP} tickets across repeated orders, then refuses the next one`, async () => {
    await order({ qty: 4, email: "boundary@example.com", phone: "0811000001" });
    await order({ qty: 3, email: "boundary@example.com", phone: "0811000001" });
    const tenth = await order({ qty: 3, email: "boundary@example.com", phone: "0811000001" });
    expect(tenth.order.status).toBe("PENDING_CONFIRMATION");

    const soldBefore = await sold(tribunId);
    await expect(order({ qty: 1, email: "boundary@example.com", phone: "0811000001" })).rejects.toMatchObject({ code: "PURCHASE_LIMIT" });

    // A refused purchase must not reserve seats or write an order.
    expect(await sold(tribunId)).toBe(soldBefore);
    const count = await prisma.ticketOrder.count({ where: { eventId, customerEmail: "boundary@example.com" } });
    expect(count).toBe(3);
  });

  it("gives a readable message that states the cap and what was already bought", async () => {
    await order({ qty: 5, email: "msg@example.com", phone: "0811000002" });
    await order({ qty: 5, email: "msg@example.com", phone: "0811000002" });

    let caught: Error | null = null;
    try {
      await order({ qty: 1, email: "msg@example.com", phone: "0811000002" });
    } catch (error) {
      caught = error as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught?.message).toContain(`Batas pembelian ${CAP} tiket`);
    expect(caught?.message).toContain("Anda sudah memesan 10 tiket");
    expect(caught?.message).toContain("Hubungi admin");
  });

  it("cannot be bypassed by re-spelling the phone number (+62 / 0 / bare 8) or the email case", async () => {
    await order({ qty: 9, email: "Phone.Case@Example.com", phone: "0812-7777-8888" });
    // Same line, three different spellings, different inbox each time.
    await expect(order({ qty: 2, email: "other1@example.com", phone: "+62 812 7777 8888" })).rejects.toMatchObject({ code: "PURCHASE_LIMIT" });
    await expect(order({ qty: 2, email: "other2@example.com", phone: "6281277778888" })).rejects.toMatchObject({ code: "PURCHASE_LIMIT" });
    await expect(order({ qty: 2, email: "other3@example.com", phone: "812 7777 8888" })).rejects.toMatchObject({ code: "PURCHASE_LIMIT" });
    // Same inbox with different casing is the same buyer too.
    await expect(order({ qty: 2, email: "phone.case@example.COM", phone: "0899999999" })).rejects.toMatchObject({ code: "PURCHASE_LIMIT" });
  });

  it("counts unconfirmed holds (a pending pile cannot exceed the cap) but not rejected orders", async () => {
    const hold = await order({ qty: 10, email: "hold@example.com", phone: "0811000003" });
    await expect(order({ qty: 1, email: "hold@example.com", phone: "0811000003" })).rejects.toMatchObject({ code: "PURCHASE_LIMIT" });
    await rejectOrder(hold.order.id, adminId, "Pembayaran tidak masuk");
    // Seats and cap released → the same buyer may buy again.
    await expect(order({ qty: 10, email: "hold@example.com", phone: "0811000003" })).resolves.toBeTruthy();
  });

  it("does not count expired/cancelled holds either", async () => {
    const stale = await order({ qty: 10, email: "stale@example.com", phone: "0811000004" });
    await prisma.ticketOrder.update({ where: { id: stale.order.id }, data: { createdAt: new Date(Date.now() - 72 * 3600_000) } });
    const summary = await expireStaleHolds({ olderThanHours: 24 });
    expect(summary.orderNumbers).toContain(stale.order.orderNumber);
    await expect(order({ qty: 10, email: "stale@example.com", phone: "0811000004" })).resolves.toBeTruthy();
  });

  it("caps per category and per event, not globally", async () => {
    await order({ qty: 5, email: "scope@example.com", phone: "0811000005" });
    await expect(order({ qty: 6, email: "scope@example.com", phone: "0811000005" })).rejects.toMatchObject({ code: "PURCHASE_LIMIT" });
    // Different category, same buyer, same event → still allowed.
    await expect(order({ ticketTypeId: vipId, qty: 6, email: "scope@example.com", phone: "0811000005" })).resolves.toBeTruthy();
    // Same category name, different event → allowed.
    await expect(order({ ticketTypeId: otherEventTribunId, event: otherEventId, qty: 6, email: "scope@example.com", phone: "0811000005" })).resolves.toBeTruthy();
  });
});
