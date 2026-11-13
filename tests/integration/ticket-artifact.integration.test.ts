/**
 * Integration tests for the ticket artifact (PDF + signed QR payload) against the real test database.
 *
 *   MYSQL_DATABASE=tfn_test npx vitest run --project integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { verifyTicketPayload } from "@/lib/ticketing/ticket-token";
import {
  confirmOrder,
  createGuestOrder,
  expireStaleHolds,
  getTicketArtifact,
  rejectOrder,
  TicketingError,
  type TicketOrderInput,
} from "@/server/services/ticketing.service";

const PREFIX = "itest-art-";
let eventId = "";
let adminId = "";
let gaId = "";

function input(overrides: Partial<TicketOrderInput> = {}): TicketOrderInput {
  return {
    eventId,
    ticketTypeId: gaId,
    quantity: 2,
    customerName: "Artifact Tester",
    customerEmail: "itest-art@example.com",
    customerPhone: "+628****2222",
    paymentMethod: "BANK_TRANSFER",
    reference: "ITEST-ART-TRX",
    ...overrides,
  };
}

beforeAll(async () => {
  adminId = (
    await prisma.user.create({
      data: { email: `${PREFIX}admin@example.com`, name: "ITest Artifact Admin", passwordHash: "not-a-real-hash", isActive: true },
    })
  ).id;

  const event = await prisma.event.create({
    data: {
      name: `${PREFIX}Artifact Night`,
      slug: `${PREFIX}artifact-night`,
      venue: "Arena Test",
      city: "Temanggung",
      country: "ID",
      startsAt: new Date(Date.now() + 20 * 24 * 3600_000),
      status: "SCHEDULED",
      isPublished: true,
    },
  });
  eventId = event.id;
  gaId = (await prisma.ticketType.create({ data: { eventId, name: "Tribun", code: "art-ga", price: 150000, quota: 100 } })).id;
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

describe("ticket artifact (real database)", () => {
  it("renders a real PDF for a confirmed order whose QR payload verifies against the order number", async () => {
    const { order, capabilityToken } = await createGuestOrder(input());
    await confirmOrder(order.id, adminId);

    const artifact = await getTicketArtifact(order.orderNumber, capabilityToken);

    expect(artifact.filename).toBe(`tiket-${order.orderNumber}.pdf`);
    // Bytes really are a PDF, not an HTML page with a .pdf name.
    expect(new TextDecoder().decode(artifact.buffer.slice(0, 5))).toBe("%PDF-");
    expect(artifact.buffer.byteLength).toBeGreaterThan(5000);

    // The payload carried in the QR must cryptographically resolve to this order.
    expect(verifyTicketPayload(artifact.payload, env().AUTH_SECRET)).toEqual({ orderNumber: order.orderNumber });
    expect(artifact.payload.split(".")[1]).toBe(order.orderNumber);

    // The PDF must be parseable and must embed the QR image (proves the QR block rendered).
    const parsed = await PDFDocument.load(artifact.buffer);
    expect(parsed.getPageCount()).toBe(1);
    const embeddedImages = parsed.context.enumerateIndirectObjects().filter(([, obj]) => {
      // Images are stored as streams, so the subtype lives on `obj.dict` (plain dicts have `get` directly).
      const holder = obj as unknown as { dict?: { get?: (key: string) => unknown }; get?: (key: string) => unknown };
      const dict = holder.dict ?? holder;
      // pdf-lib dict keys are PDFName instances — a plain string silently returns undefined.
      return typeof dict.get === "function" && String(dict.get(PDFName.of("Subtype") as never)) === "/Image";
    });
    expect(embeddedImages.length).toBeGreaterThanOrEqual(1);

    // Metadata is set so the buyer and admin can identify the file offline.
    expect(parsed.getTitle()).toContain(order.orderNumber);
  });

  it("refuses pending, rejected, and expired orders", async () => {
    const pending = await createGuestOrder(input());
    await expect(getTicketArtifact(pending.order.orderNumber, pending.capabilityToken)).rejects.toMatchObject({ code: "INVALID_STATE" });

    const rejected = await createGuestOrder(input());
    await rejectOrder(rejected.order.id, adminId, "Bukti tidak valid");
    await expect(getTicketArtifact(rejected.order.orderNumber, rejected.capabilityToken)).rejects.toMatchObject({ code: "INVALID_STATE" });

    const expired = await createGuestOrder(input());
    await prisma.ticketOrder.update({ where: { id: expired.order.id }, data: { createdAt: new Date(Date.now() - 48 * 3600_000) } });
    await expireStaleHolds({ olderThanHours: 24 });
    await expect(getTicketArtifact(expired.order.orderNumber, expired.capabilityToken)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("treats a wrong or missing token exactly like an unknown order (no enumeration)", async () => {
    const { order } = await createGuestOrder(input());
    await confirmOrder(order.id, adminId);

    await expect(getTicketArtifact(order.orderNumber, "wrong-token")).rejects.toBeInstanceOf(TicketingError);
    await expect(getTicketArtifact(order.orderNumber, "wrong-token")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getTicketArtifact("TFN-DOESNOTEXIST-000000", "whatever")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is deterministic per order: two renders produce the same payload", async () => {
    const { order, capabilityToken } = await createGuestOrder(input());
    await confirmOrder(order.id, adminId);

    const first = await getTicketArtifact(order.orderNumber, capabilityToken);
    const second = await getTicketArtifact(order.orderNumber, capabilityToken);

    expect(second.payload).toBe(first.payload);
    expect(second.buffer.byteLength).toBe(first.buffer.byteLength);
  });
});
