/**
 * Live probe for the per-buyer cap against the running production build.
 * Creates a throwaway event + category in the app DB, buys to the cap, then verifies the 409.
 * Cleans up everything it created.
 *
 *   MYSQL_DATABASE=tfn_test npx tsx scripts/verify/probe-buyer-cap.mts
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../src/generated/prisma/client";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3015";
const PREFIX = "probecap-";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    allowPublicKeyRetrieval: true,
  }),
});

async function post(body: unknown) {
  const res = await fetch(`${BASE}/api/ticketing/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const event = await prisma.event.create({
  data: { name: `${PREFIX}Night`, slug: `${PREFIX}night`, venue: "Arena", city: "Temanggung", startsAt: new Date(Date.now() + 30 * 24 * 3600_000), status: "SCHEDULED", isPublished: true },
});
const type = await prisma.ticketType.create({ data: { eventId: event.id, name: "Tribun", code: `${PREFIX}tribun`, price: 100000, quota: 500 } });

const base = { eventId: event.id, ticketTypeId: type.id, customerName: "Probe Buyer", customerEmail: "Probe.Buyer@Example.com", customerPhone: "0812-0000-1111", paymentMethod: "BANK_TRANSFER", reference: "PROBE" };

try {
  const first = await post({ ...base, quantity: 6 });
  console.log(`buy 6            -> ${first.status} ${first.body.orderNumber ?? first.body.error}`);

  const second = await post({ ...base, quantity: 4, customerEmail: "probe.buyer@example.COM" });
  console.log(`buy 4 (re-case)  -> ${second.status} ${second.body.orderNumber ?? second.body.error}`);

  const blocked = await post({ ...base, quantity: 1, customerPhone: "+62 812 0000 1111", customerEmail: "different@example.com" });
  console.log(`buy 1 (+62 form) -> ${blocked.status} ${blocked.body.error ?? blocked.body.orderNumber}`);

  const sold = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  const orders = await prisma.ticketOrder.count({ where: { eventId: event.id } });
  console.log(`db: sold=${sold.sold} (expect 10) orders=${orders} (expect 2)`);
} finally {
  const ids = (await prisma.ticketOrder.findMany({ where: { eventId: event.id }, select: { id: true } })).map((o) => o.id);
  if (ids.length) await prisma.auditLog.deleteMany({ where: { entityType: "TicketOrder", entityId: { in: ids } } });
  await prisma.ticketOrder.deleteMany({ where: { eventId: event.id } });
  await prisma.ticketType.deleteMany({ where: { eventId: event.id } });
  await prisma.event.deleteMany({ where: { id: event.id } });
  await prisma.$disconnect();
  console.log("cleaned up");
}
