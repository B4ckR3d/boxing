/**
 * Negative control untuk Gate A2 — memastikan tes konkurensi benar-benar bergigi.
 *
 * Tes konkurensi bisa "hijau karena kebetulan" (mis. semua order gagal karena alasan lain, atau
 * guard-nya tidak pernah aktif). Berkas ini memaksa guard bekerja pada kuota yang sangat kecil:
 * kuota 3 vs 20 order paralel harus menghasilkan tepat 3 sukses dan 17 penolakan domain.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createGuestOrder, TicketingError, type TicketOrderInput } from "@/server/services/ticketing.service";

const PREFIX = "itest-negctl-";
let eventId = "";

beforeAll(async () => {
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
});

afterAll(async () => {
  if (!eventId) return;
  const orders = await prisma.ticketOrder.findMany({ where: { eventId }, select: { id: true } });
  await prisma.auditLog.deleteMany({
    where: { entityType: "TicketOrder", entityId: { in: orders.map((o) => o.id) } },
  });
  await prisma.ticketOrder.deleteMany({ where: { eventId } });
  await prisma.ticketType.deleteMany({ where: { eventId } });
  await prisma.event.deleteMany({ where: { id: eventId } });
  await prisma.$disconnect();
});

describe("Gate A2 — negative control", () => {
  it("kuota 3 vs 20 order paralel → tepat 3 sukses, 17 ditolak, sold = 3", async () => {
    const type = await prisma.ticketType.create({
      data: { eventId, name: "Tiny", code: "tiny", price: 50000, quota: 3 },
    });

    const input = (i: number): TicketOrderInput => ({
      eventId,
      ticketTypeId: type.id,
      quantity: 1,
      paymentMethod: "BANK_TRANSFER",
      reference: undefined,
      customerName: `Nc Buyer ${i}`,
      customerEmail: `${PREFIX}b${i}@example.com`,
      customerPhone: `+6282${String(i).padStart(8, "0")}`,
    });

    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => createGuestOrder(input(i))));

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected");
    const nonDomain = rejected.filter((r) => !((r as PromiseRejectedResult).reason instanceof TicketingError));

    const sold = (
      await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id }, select: { sold: true } })
    ).sold;

    console.log(`  [negctl] kuota=3 sukses=${fulfilled} ditolak=${rejected.length} sold=${sold}`);

    expect(fulfilled).toBe(3);
    expect(rejected).toHaveLength(17);
    expect(nonDomain).toHaveLength(0);
    expect(sold).toBe(3);
  }, 120_000);
});
