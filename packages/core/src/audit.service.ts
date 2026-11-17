/**
 * Audit log — satu-satunya jalur penulisan `AuditLog` di luar ticketing.
 *
 * Pindah dari `apps/web/src/server/services/audit.service.ts` karena `apps/api` juga menulis audit
 * (confirm/reject/check-in memakai `tx.auditLog` langsung, tapi settings & RBAC butuh helper ini).
 *
 * Perubahan penting dibanding versi web:
 *   - **tidak** memakai `next/headers`. Konteks request (IP / User-Agent) diinjeksi lewat
 *     `AuditContext`. Di Next, binding web mengisinya dari `headers()`; di Express dari `req`.
 *     Ini yang membuat modul bisa dipakai proses non-HTTP seperti worker.
 *   - `db` diinjeksi agar bisa ikut transaksi pemanggil (`db` = `tx`).
 *
 * Kontrak lama dipertahankan: kegagalan menulis audit **tidak** boleh menggagalkan operasi utama,
 * hanya dicatat ke stderr. Audit adalah bukti, bukan syarat commit.
 */
import type { PrismaClient } from "@tfn/db/client";
import { redact } from "./redact.js";

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Db = PrismaClient | Tx;

/** Konteks request opsional. Kosong untuk worker/cron. */
export type AuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export interface LogAuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  db?: Db;
  context?: AuditContext;
}

export type AuditDeps = {
  db: Db;
  /** Diisi binding app: `() => headers()` di Next, `req` di Express, `{}` di worker. */
  context?: () => AuditContext | Promise<AuditContext>;
};

export async function logAudit(deps: AuditDeps, params: LogAuditParams): Promise<void> {
  const db = params.db ?? deps.db;
  try {
    let ipAddress: string | null = params.context?.ipAddress ?? null;
    let userAgent: string | null = params.context?.userAgent?.slice(0, 255) ?? null;

    if (!params.context && deps.context) {
      try {
        const ctx = await deps.context();
        ipAddress = ctx.ipAddress ?? null;
        userAgent = ctx.userAgent?.slice(0, 255) ?? null;
      } catch {
        // Konteks request tidak tersedia (worker, migrasi, CLI). Bukan error.
      }
    }

    const safeMeta = params.metadata ? (redact(params.metadata) as unknown as object) : undefined;

    await db.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ? String(params.entityId) : null,
        summary: params.summary.slice(0, 500),
        metadata: safeMeta,
        ipAddress: ipAddress ? ipAddress.slice(0, 64) : null,
        userAgent,
      },
    });
  } catch (err) {
    // Audit gagal tidak boleh membatalkan operasi utama; tetap terlihat di log proses.
    console.error("[audit] gagal menulis audit log:", err);
  }
}
