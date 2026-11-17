/**
 * Gate A2 — konkurensi ticketing pada database nyata.
 *
 * Klaim di dokumen ("50 request paralel → tepat 50 kursi, 0 oversell") sebelumnya hanya
 * dibuktikan oleh tes 2 order. Berkas ini menguji invariant itu pada skala yang diklaim,
 * supaya pemindahan ticketing ke `apps/api` (Langkah C) punya pembanding yang sah.
 *
 * Catatan desain penting:
 * - Cap per pembeli = 10 tiket/kategori, jadi 50 order paralel memakai **50 pembeli berbeda**
 *   (email & telepon unik). Kalau memakai satu email, kegagalan akan datang dari cap, bukan
 *   dari bug kapasitas — tes jadi hijau/merah karena alasan yang salah.
 * - Kuota kategori dibuat **tepat** sebesar jumlah order agar batasnya benar-benar diperebutkan.
 * - `sold` dibaca ulang dari DB setelah gelombang selesai; invariantnya `sold <= quota`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createGuestOrder, TicketingError, type TicketOrderInput } from "@/server/services/ticketing.service";

const PREFIX = "itest-conc-";
const QUOTA = 50;
const CONCURRENT = 50;

let eventId = "";

function buyer(index: number) {
  return {
    customerName: `Buyer ${index}`,
    customerEmail: `${PREFIX}buyer${index}@example.com`,
    customerPhone: `+6281${String(index).padStart(8, "0")}`,
  };
}

function orderInput(ticketTypeId: string, index: number): TicketOrderInput {
  return {
    eventId,
    ticketTypeId,
    quantity: 1,
    paymentMethod: "BANK_TRANSFER",
    reference: undefined,
    ...buyer(index),
  };
}

async function makeTicketType(code: string): Promise<string> {
  const row = await prisma.ticketType.create({
    data: { eventId, name: `Conc ${code}`, code, price: 100000, quota: QUOTA },
  });
  return row.id;
}

async function soldOf(ticketTypeId: string): Promise<number> {
  const row = await prisma.ticketType.findUniqueOrThrow({
    where: { id: ticketTypeId },
    select: { sold: true },
  });
  return row.sold;
}

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
  const ids = orders.map((o) => o.id);
  await prisma.auditLog.deleteMany({ where: { entityType: "TicketOrder", entityId: { in: ids } } });
  await prisma.ticketOrder.deleteMany({ where: { eventId } });
  await prisma.ticketType.deleteMany({ where: { eventId } });
  await prisma.event.deleteMany({ where: { id: eventId } });
  await prisma.$disconnect();
});

describe("Gate A2 — konkurensi ticketing (real database)", () => {
  it(`${CONCURRENT} order paralel untuk ${QUOTA} kursi → tepat ${QUOTA} berhasil, 0 oversell`, async () => {
    const ticketTypeId = await makeTicketType("conc-exact");

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT }, (_, i) => createGuestOrder(orderInput(ticketTypeId, i))),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Semua penolakan harus berupa kesalahan domain, bukan crash/timeout/pool habis.
    const nonDomain = rejected.filter((r) => !((r as PromiseRejectedResult).reason instanceof TicketingError));

    expect({ fulfilled: fulfilled.length, rejected: rejected.length }).toEqual({
      fulfilled: QUOTA,
      rejected: CONCURRENT - QUOTA,
    });
    expect(nonDomain.map((r) => String((r as PromiseRejectedResult).reason))).toEqual([]);

    // Invariant utama: tidak pernah melebihi kuota.
    expect(await soldOf(ticketTypeId)).toBe(QUOTA);
  }, 120_000);

  it(`kelebihan permintaan ${CONCURRENT + 10} paralel untuk ${QUOTA} kursi → tetap ${QUOTA}, tidak pernah ${QUOTA + 1}`, async () => {
    const ticketTypeId = await makeTicketType("conc-over");

    const total = CONCURRENT + 10;
    const results = await Promise.allSettled(
      Array.from({ length: total }, (_, i) => createGuestOrder(orderInput(ticketTypeId, i))),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const sold = await soldOf(ticketTypeId);

    expect(fulfilled).toBe(QUOTA);
    expect(sold).toBe(QUOTA);
    expect(sold).toBeLessThanOrEqual(QUOTA);
  }, 120_000);
});
