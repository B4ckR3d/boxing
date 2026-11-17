/**
 * Prisma client untuk `apps/worker`.
 *
 * Sebelumnya worker memakai client milik `apps/web` lewat alias, sehingga proses worker ikut
 * memuat penanda `server-only` dan `--conditions=react-server` wajib. Sekarang pool sendiri,
 * terpisah dari web dan api — sesuai ADR-009: schema tetap satu di root, client per proses.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@tfn/db/client";
import { env } from "./env.js";

function createClient(): PrismaClient {
  const e = env();
  const adapter = new PrismaMariaDb({
    host: e.MYSQL_HOST,
    port: e.MYSQL_PORT,
    user: e.MYSQL_USER,
    password: e.MYSQL_PASSWORD,
    database: e.MYSQL_DATABASE,
    connectionLimit: e.DATABASE_POOL_SIZE,
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({
    adapter,
    log: e.NODE_ENV === "development" ? [{ emit: "event", level: "error" }] : [{ emit: "event", level: "error" }],
  });
}

const globalForPrisma = globalThis as unknown as { __tfnWorkerPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__tfnWorkerPrisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.__tfnWorkerPrisma = prisma;

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
