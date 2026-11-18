import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@tfn/db/client";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

/**
 * Prisma client untuk `apps/api`.
 *
 * ADR-009: schema TIDAK diduplikasi di sini. Client digenerate dari `prisma/schema.prisma`
 * di root (`pnpm --filter @tfn/api db:generate`), jadi kedua app membaca skema & riwayat
 * migration yang sama.
 */
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
    log: [{ emit: "event", level: "error" }],
  });
}

const globalForPrisma = globalThis as unknown as { __tfnApiPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__tfnApiPrisma ?? createClient();
if (env().NODE_ENV !== "production") globalForPrisma.__tfnApiPrisma = prisma;

/** Ping ringan untuk readiness probe (tidak menyentuh tabel bisnis). */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectDatabase(): Promise<void> {
  logger().info("disconnecting prisma");
  await prisma.$disconnect();
}
