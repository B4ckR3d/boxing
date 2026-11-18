import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  if (!hasPermission(session, "audit.read")) {
    return (
      <div className="space-y-4 text-ink select-none">
        <h1 className="font-display text-3xl uppercase font-black">
          Commission Audit Logs
        </h1>
        <div className="border border-fight-red bg-charcoal p-8 text-center">
          <p className="font-mono-data text-sm font-bold text-fight-red uppercase">
            Access Denied
          </p>
          <p className="font-mono-data text-xs text-ink-muted mt-2">
            Required permission: <code>audit.read</code>.
          </p>
        </div>
      </div>
    );
  }

  const { action } = await searchParams;

  const logs = await prisma.auditLog.findMany({
    where: action ? { action } : undefined,
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return (
    <div className="space-y-6 text-ink select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              SECURITY & COMPLIANCE
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              TAMPER-EVIDENT LEDGER
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            COMMISSION AUDIT LOGS
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Complete cryptographic audit trail of administrative modifications, ranking staging, result certification, and role escalations.
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-charcoal border border-subtle shadow-xl overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono-data text-xs">
          <thead>
            <tr className="border-b border-subtle bg-canvas text-ink-muted uppercase text-[10px]">
              <th className="py-3 px-4">TIMESTAMP</th>
              <th className="py-3 px-4">ACTION</th>
              <th className="py-3 px-4">ENTITY</th>
              <th className="py-3 px-4">ACTOR</th>
              <th className="py-3 px-4">SUMMARY</th>
              <th className="py-3 px-4">IP ADDRESS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/60">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink-subtle">
                  No audit log entries recorded.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-elevated transition-colors">
                  <td className="py-3 px-4 text-ink-muted">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-fight-red font-bold">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-ink-muted">
                    {log.entityType}
                  </td>
                  <td className="py-3 px-4 text-ink font-bold">
                    {log.actor?.name || "System Automated"}
                  </td>
                  <td className="py-3 px-4 text-ink-muted">
                    {log.summary}
                  </td>
                  <td className="py-3 px-4 text-ink-subtle">
                    {log.ipAddress || "127.0.0.1"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
