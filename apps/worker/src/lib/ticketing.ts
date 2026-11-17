/**
 * Binding `apps/worker` → `@tfn/ticketing`.
 *
 * Sebelumnya worker mengimpor `@/server/services/ticketing.service` lewat alias ke `../web/src/*`,
 * yang memaksa dua hal yang tidak seharusnya: proses worker harus memuat penanda `server-only`
 * (butuh `--conditions=react-server`), dan worker bergantung pada seluruh source Next.js.
 *
 * Sekarang worker hanya butuh Prisma + `AUTH_SECRET`. `--conditions=react-server` masih
 * dipertahankan di script demi kompatibilitas, tetapi tidak lagi wajib untuk modul ini.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";
import { env } from "./env.js";
import {
  expireStaleHolds as expireStaleHoldsDomain,
  type TicketingDeps,
} from "@tfn/ticketing";

const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");
const sha256Hex = (input: string | Buffer): string => createHash("sha256").update(input).digest("hex");

export function workerTicketingDeps(): TicketingDeps {
  return { db: prisma, ticketSecret: env().AUTH_SECRET, randomToken, sha256Hex };
}

export const expireStaleHolds = (
  options: { olderThanHours?: number; now?: Date; limit?: number; actorId?: string | null } = {},
) => expireStaleHoldsDomain(workerTicketingDeps(), options);
