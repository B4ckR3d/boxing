/**
 * Binding `apps/web` → `@tfn/core` (audit).
 *
 * Call site lama (`@/server/services/audit.service`) tetap valid. Konteks request diambil dari
 * `headers()` Next di sini — bukan di paket — supaya paket bisa dipakai worker/CLI tanpa
 * `next/headers`.
 */
import { headers } from "next/headers";
import { prisma, type Db } from "@/lib/db/prisma";
import { logAudit as logAuditDomain, type AuditContext, type LogAuditParams } from "@tfn/core/audit";

export type { LogAuditParams };

async function requestContext(): Promise<AuditContext> {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
  };
}

export async function logAudit(params: LogAuditParams & { db?: Db }): Promise<void> {
  return logAuditDomain({ db: prisma, context: requestContext }, params);
}
