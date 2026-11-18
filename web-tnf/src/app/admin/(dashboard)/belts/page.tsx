import React from "react";
import { requirePermission } from "@/lib/permissions/guard";
import { prisma } from "@/lib/db/prisma";
import { BeltManager } from "@/components/admin/BeltManager";

export const dynamic = "force-dynamic";

export default async function AdminBeltsPage() {
  await requirePermission("belts.manage");

  const [belts, weightClasses, fighters] = await Promise.all([
    prisma.championshipBelt.findMany({
      include: {
        weightClass: true,
        image: true,
        reigns: {
          include: {
            fighter: true,
            defenses: true,
          },
          orderBy: { wonAt: "desc" },
        },
      },
      orderBy: { sortOrder: "asc" },
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
    <BeltManager
      belts={belts.map((belt) => {
        const active = belt.reigns.find((r) => r.status === "ACTIVE");
        const historical = belt.reigns.filter((r) => r.status !== "ACTIVE");
        return {
          id: belt.id,
          name: belt.name,
          slug: belt.slug,
          status: belt.status,
          weightClassName: belt.weightClass.name,
          weightLimitLbs: String(belt.weightClass.limitLbs),
          imageUrl: belt.image?.url ?? null,
          nextDefenseNote: belt.nextDefenseNote,
          activeReign: active
            ? {
                id: active.id,
                fighterId: active.fighterId,
                fighterName: `${active.fighter.firstName} ${active.fighter.lastName}`,
                ringName: active.fighter.ringName,
                wonAt: active.wonAt.toISOString(),
                defensesCount: active.defenses.length,
              }
            : null,
          historicalReigns: historical.map((hr) => ({
            id: hr.id,
            fighterName: `${hr.fighter.firstName} ${hr.fighter.lastName}`,
            wonYear: hr.wonAt ? String(new Date(hr.wonAt).getFullYear()) : "",
            endedYear: hr.endedAt ? String(new Date(hr.endedAt).getFullYear()) : "Present",
          })),
        };
      })}
      weightClasses={weightClasses.map((wc) => ({
        id: wc.id,
        name: wc.name,
        limitLbs: String(wc.limitLbs),
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
