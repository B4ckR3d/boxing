import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import { normalizeSponsorTier } from "@/lib/sponsors/tiers";
import { SponsorManager, type SponsorItem } from "@/components/admin/SponsorManager";

export const dynamic = "force-dynamic";

export default async function AdminSponsorsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const canManage =
    session.roles.includes("super_admin") || hasPermission(session, "content.manage");

  const rows = await prisma.sponsor.findMany({
    include: { logo: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const sponsors: SponsorItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    tier: normalizeSponsorTier(row.tier),
    url: row.url,
    logoUrl: row.logo?.deletedAt ? null : row.logo?.url ?? null,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return <SponsorManager sponsors={sponsors} canManage={canManage} />;
}
