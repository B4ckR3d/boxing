import "server-only";
import { headers } from "next/headers";
import { prisma, type Db } from "@/lib/db/prisma";
import { redact } from "@/lib/security/redact";

export interface LogAuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  db?: Db;
}

export async function logAudit({
  actorId,
  action,
  entityType,
  entityId,
  summary,
  metadata,
  db = prisma,
}: LogAuditParams): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    try {
      const h = await headers();
      ipAddress =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
      userAgent = h.get("user-agent")?.slice(0, 255) ?? null;
    } catch {
      // In background scripts / migrations, headers() may not be available
    }

    const safeMeta = metadata ? (redact(metadata) as unknown as object) : undefined;

    await db.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        summary: summary.slice(0, 500),
        metadata: safeMeta,
        ipAddress: ipAddress ? ipAddress.slice(0, 64) : null,
        userAgent,
      },
    });
  } catch (err) {
    // Audit log failure must not crash the primary transaction, but should be logged
    console.error("[audit.service] Failed to write audit log:", err);
  }
}

