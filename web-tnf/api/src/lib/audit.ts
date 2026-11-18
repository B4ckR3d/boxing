/**
 * Binding `apps/api` → `@tfn/core` (audit).
 *
 * Konteks request diambil dari `req` Express (IP di balik proxy + User-Agent), bukan `next/headers`.
 * Ini yang membuat `updateSettings` di API mencatat petugas yang benar di audit log.
 *
 * Kenapa `AsyncLocalStorage` dan bukan variabel modul: Express melayani request secara konkuren di
 * satu proses. Variabel modul akan saling menimpa, sehingga audit petugas A bisa tercatat dengan IP
 * petugas B — bukti audit yang salah lebih buruk daripada tidak ada audit.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";
import { logAudit as logAuditDomain, type AuditContext, type LogAuditParams } from "@tfn/core/audit";
import { prisma } from "../db/prisma.js";

const storage = new AsyncLocalStorage<AuditContext>();

export function withAuditContext<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const context: AuditContext = {
    ipAddress:
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? null,
    userAgent: (req.headers["user-agent"] as string | undefined)?.slice(0, 255) ?? null,
  };
  return storage.run(context, fn);
}

export async function logAudit(params: Omit<LogAuditParams, "context">): Promise<void> {
  return logAuditDomain({ db: prisma, context: () => storage.getStore() ?? {} }, params);
}
