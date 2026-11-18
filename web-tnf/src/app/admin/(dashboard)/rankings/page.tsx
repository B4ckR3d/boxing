import React from "react";
import { requirePermission, hasPermission } from "@/lib/permissions/guard";
import { prisma } from "@/lib/db/prisma";
import { RankingManager } from "@/components/admin/RankingManager";

export const dynamic = "force-dynamic";

export default async function AdminRankingsPage() {
  const session = await requirePermission("rankings.read");

  const [versions, weightClasses, fighters] = await Promise.all([
    prisma.rankingVersion.findMany({
      include: {
        weightClass: true,
        entries: {
          include: { fighter: true },
          orderBy: [{ isChampion: "desc" }, { rank: "asc" }],
        },
      },
      orderBy: [{ effectiveDate: "desc" }, { versionNumber: "desc" }],
      take: 20,
    }),
    prisma.weightClass.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.fighter.findMany({
      where: { deletedAt: null },
      include: { weightClass: true },
      orderBy: [{ wins: "desc" }, { lastName: "asc" }],
    }),
  ]);

  return (
    <RankingManager
      versions={versions.map((v) => ({
        id: v.id,
        type: v.type,
        versionNumber: v.versionNumber,
        status: v.status,
        effectiveDate: v.effectiveDate.toISOString(),
        notes: v.notes,
        weightClassName: v.weightClass?.name ?? null,
        gender: v.gender,
        entries: v.entries.map((e) => ({
          id: e.id,
          rank: e.rank,
          isChampion: e.isChampion,
          points: Number(e.points || 0),
          fighterName: `${e.fighter.firstName} ${e.fighter.lastName}`,
          record: `${e.fighter.wins}-${e.fighter.losses}-${e.fighter.draws}`,
        })),
      }))}
      weightClasses={weightClasses.map((wc) => ({
        id: wc.id,
        name: wc.name,
        gender: wc.gender,
      }))}
      fighters={fighters.map((f) => ({
        id: f.id,
        name: `${f.firstName} ${f.lastName}`,
        weightClassId: f.weightClassId,
        weightClassName: f.weightClass.name,
        record: `${f.wins}-${f.losses}-${f.draws}`,
      }))}
      canManage={hasPermission(session, "rankings.manage")}
      canPublish={hasPermission(session, "rankings.publish")}
    />
  );
}
