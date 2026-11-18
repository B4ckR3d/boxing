import React from "react";
import { requirePermission, hasPermission } from "@/lib/permissions/guard";
import { prisma } from "@/lib/db/prisma";
import { FighterManager, type FighterItem } from "@/components/admin/FighterManager";

export const dynamic = "force-dynamic";

export default async function AdminFightersPage() {
  const session = await requirePermission("fighters.read");

  const [rawFighters, weightClasses] = await Promise.all([
    prisma.fighter.findMany({
      where: { deletedAt: null },
      include: {
        weightClass: true,
        portrait: true,
        currentRankings: true,
      },
      orderBy: [{ wins: "desc" }, { lastName: "asc" }],
    }),
    prisma.weightClass.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const fighters: FighterItem[] = rawFighters.map((f) => ({
    id: f.id,
    slug: f.slug,
    firstName: f.firstName,
    lastName: f.lastName,
    ringName: f.ringName,
    gender: f.gender,
    nationality: f.nationality,
    hometown: f.hometown,
    heightCm: f.heightCm,
    reachCm: f.reachCm,
    stance: f.stance,
    weightClassId: f.weightClassId,
    weightClassName: f.weightClass.name,
    weightClassSlug: f.weightClass.slug,
    status: f.status,
    wins: f.wins,
    losses: f.losses,
    draws: f.draws,
    koWins: f.koWins,
    bio: f.bio,
    portraitId: f.portraitId,
    portraitUrl: f.portrait?.url ?? null,
    isChampion: f.currentRankings.some((r) => r.isChampion),
  }));

  return (
    <FighterManager
      fighters={fighters}
      weightClasses={weightClasses.map((wc) => ({
        id: wc.id,
        name: wc.name,
        slug: wc.slug,
        gender: wc.gender,
      }))}
      canCreate={hasPermission(session, "fighters.create")}
      canUpdate={hasPermission(session, "fighters.update")}
      canDelete={hasPermission(session, "fighters.delete")}
    />
  );
}
