import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import {
  getRegistrationStats,
  listFighterRegistrations,
  sheetsConfigured,
} from "@/server/services/fighter-registration.service";
import { RegistrationManager, type RegistrationRow } from "@/components/admin/RegistrationManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pendaftaran Fighter — Admin TFN",
  robots: { index: false, follow: false },
};

export default async function AdminRegistrationsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const canRead = session.roles.includes("super_admin") || hasPermission(session, "registrations.read");
  if (!canRead) redirect("/admin?error=forbidden");

  const canConfirm = session.roles.includes("super_admin") || hasPermission(session, "registrations.confirm");

  const [rows, stats] = await Promise.all([listFighterRegistrations({ take: 200 }), getRegistrationStats()]);

  const registrations: RegistrationRow[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    fullName: row.fullName,
    ringName: row.ringName,
    address: row.address,
    age: row.age,
    divisionLabel: row.divisionLabel,
    weightClassName: row.weightClass?.name ?? null,
    rules: row.rules,
    competitionClass: row.competitionClass,
    bpjsStatus: row.bpjsStatus,
    socialUrl: row.socialUrl,
    instagramUrl: row.instagramUrl,
    tiktokUrl: row.tiktokUrl,
    facebookUrl: row.facebookUrl,
    xUrl: row.xUrl,
    paymentAmount: Number(row.paymentAmount),
    paymentProof: row.paymentProofPath
      ? { name: row.paymentProofName, mime: row.paymentProofMime, url: `/api/admin/registrations/${row.id}/file/payment-proof` }
      : null,
    idDocument: row.idDocumentPath
      ? { name: row.idDocumentName, mime: row.idDocumentMime, url: `/api/admin/registrations/${row.id}/file/id-document` }
      : null,
    status: row.status,
    confirmedByName: row.confirmedBy?.name ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    reviewNotes: row.reviewNotes,
    sheetRowNumber: row.sheetRowNumber,
    sheetSyncedAt: row.sheetSyncedAt?.toISOString() ?? null,
    sheetSyncError: row.sheetSyncError,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <RegistrationManager
      registrations={registrations}
      stats={stats}
      canConfirm={canConfirm}
      sheetsConfigured={sheetsConfigured()}
    />
  );
}
