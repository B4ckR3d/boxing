import React from "react";
import { requirePermission } from "@/lib/permissions/guard";
import { prisma } from "@/lib/db/prisma";
import { TournamentManager } from "@/components/admin/TournamentManager";

export const dynamic = "force-dynamic";

export default async function AdminGrandPrixPage() {
  await requirePermission("tournaments.manage");

  const [tournaments, weightClasses, fighters] = await Promise.all([
    prisma.tournament.findMany({
      include: {
        weightClass: true,
        poster: true,
        participants: {
          include: { fighter: true },
          orderBy: { seed: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
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
    <TournamentManager
      tournaments={tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        weightClassId: t.weightClassId,
        weightClassName: t.weightClass.name,
        format: t.format,
        status: t.status,
        size: t.size,
        prize: t.prize,
        titleAwarded: t.titleAwarded,
        description: t.description,
        startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : null,
        posterUrl: t.poster?.url ?? null,
        isPublished: t.isPublished,
        participants: t.participants.map((p) => ({
          id: p.id,
          fighterId: p.fighterId,
          seed: p.seed,
          fighterName: `${p.fighter.firstName} ${p.fighter.lastName}`,
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
      }))}
    />
  );
}
