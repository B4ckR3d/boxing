"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { DomainValidationError, actionError, type ActionResult } from "@/lib/actions/result";

export interface RankingEntryInput {
  fighterId: string;
  points?: number | null;
}

export interface CreateRankingVersionInput {
  type: "DIVISION" | "POUND_FOR_POUND";
  weightClassId?: string;
  gender?: "MALE" | "FEMALE";
  effectiveDate: string;
  notes?: string;
  championFighterId?: string;
  contenders: RankingEntryInput[];
  publishNow?: boolean;
}

export async function createRankingVersionAction(
  input: CreateRankingVersionInput,
): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("rankings.manage");

    const type = input.type === "POUND_FOR_POUND" ? "POUND_FOR_POUND" : "DIVISION";
    let scopeKey: string;
    let weightClassId: string | null = null;
    let gender: "MALE" | "FEMALE" | null = null;

    if (type === "DIVISION") {
      if (!input.weightClassId) {
        throw new DomainValidationError("Divisi kelas berat wajib dipilih");
      }
      weightClassId = input.weightClassId;
      scopeKey = `DIV:${weightClassId}`;
    } else {
      gender = input.gender === "FEMALE" ? "FEMALE" : "MALE";
      scopeKey = `P4P:${gender}`;
    }

    const usedFighters = new Set<string>();
    const entriesToCreate: Array<{
      fighterId: string;
      rank: number | null;
      isChampion: boolean;
      points: number | null;
    }> = [];

    if (input.championFighterId) {
      usedFighters.add(input.championFighterId);
      entriesToCreate.push({
        fighterId: input.championFighterId,
        rank: null,
        isChampion: true,
        points: 100,
      });
    }

    let rankCursor = 1;
    for (const c of input.contenders ?? []) {
      if (!c.fighterId || usedFighters.has(c.fighterId)) continue;
      usedFighters.add(c.fighterId);
      const pts = c.points !== undefined && c.points !== null && Number.isFinite(Number(c.points))
        ? Number(c.points)
        : null;
      entriesToCreate.push({
        fighterId: c.fighterId,
        rank: rankCursor++,
        isChampion: false,
        points: pts,
      });
    }

    if (entriesToCreate.length === 0) {
      throw new DomainValidationError("Pilih minimal 1 petarung (Champion atau Contender)");
    }

    const canPublish = Boolean(input.publishNow) && hasPermission(user, "rankings.publish");
    const parsedDate = input.effectiveDate ? new Date(input.effectiveDate) : new Date();
    const effectiveDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    await prisma.$transaction(async (tx) => {
      const latest = await tx.rankingVersion.findFirst({
        where: { scopeKey },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersion = (latest?.versionNumber ?? 0) + 1;

      if (canPublish) {
        await tx.rankingVersion.updateMany({
          where: { scopeKey, status: "PUBLISHED" },
          data: { status: "SUPERSEDED" },
        });
      }

      const created = await tx.rankingVersion.create({
        data: {
          type,
          weightClassId,
          gender,
          scopeKey,
          versionNumber: nextVersion,
          status: canPublish ? "PUBLISHED" : "DRAFT",
          effectiveDate,
          notes: input.notes?.trim() || null,
          createdById: user.id,
          approvedById: canPublish ? user.id : null,
          publishedAt: canPublish ? new Date() : null,
          entries: {
            create: entriesToCreate.map((e) => ({
              fighterId: e.fighterId,
              rank: e.rank,
              isChampion: e.isChampion,
              points: e.points,
            })),
          },
        },
      });

      if (canPublish) {
        await tx.fighterRanking.deleteMany({ where: { scopeKey } });
        await tx.fighterRanking.createMany({
          data: entriesToCreate.map((e) => ({
            fighterId: e.fighterId,
            scopeKey,
            versionId: created.id,
            rank: e.rank,
            isChampion: e.isChampion,
          })),
        });
      }
    });

    revalidatePath("/admin/rankings");
    revalidatePath("/rankings");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateRankingVersionAction(
  input: {
    versionId: string;
    effectiveDate?: string;
    notes?: string;
    championFighterId?: string;
    contenders: RankingEntryInput[];
    publishNow?: boolean;
  },
): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("rankings.manage");

    const version = await prisma.rankingVersion.findUnique({
      where: { id: input.versionId },
    });
    if (!version) {
      return { ok: false, error: "Versi peringkat tidak ditemukan" };
    }

    const usedFighters = new Set<string>();
    const entriesToCreate: Array<{
      fighterId: string;
      rank: number | null;
      isChampion: boolean;
      points: number | null;
    }> = [];

    if (input.championFighterId) {
      usedFighters.add(input.championFighterId);
      entriesToCreate.push({
        fighterId: input.championFighterId,
        rank: null,
        isChampion: true,
        points: 100,
      });
    }

    let rankCursor = 1;
    for (const c of input.contenders ?? []) {
      if (!c.fighterId || usedFighters.has(c.fighterId)) continue;
      usedFighters.add(c.fighterId);
      const pts = c.points !== undefined && c.points !== null && Number.isFinite(Number(c.points))
        ? Number(c.points)
        : null;
      entriesToCreate.push({
        fighterId: c.fighterId,
        rank: rankCursor++,
        isChampion: false,
        points: pts,
      });
    }

    if (entriesToCreate.length === 0) {
      throw new DomainValidationError("Pilih minimal 1 petarung (Champion atau Contender)");
    }

    const canPublish = Boolean(input.publishNow) && hasPermission(user, "rankings.publish");
    const parsedDate = input.effectiveDate ? new Date(input.effectiveDate) : version.effectiveDate;
    const effectiveDate = Number.isNaN(parsedDate.getTime()) ? version.effectiveDate : parsedDate;

    await prisma.$transaction(async (tx) => {
      if (canPublish && version.status !== "PUBLISHED") {
        await tx.rankingVersion.updateMany({
          where: { scopeKey: version.scopeKey, status: "PUBLISHED" },
          data: { status: "SUPERSEDED" },
        });
      }

      await tx.rankingVersion.update({
        where: { id: version.id },
        data: {
          effectiveDate,
          notes: input.notes !== undefined ? input.notes.trim() || null : version.notes,
          status: canPublish ? "PUBLISHED" : version.status,
          approvedById: canPublish ? user.id : version.approvedById,
          publishedAt: canPublish ? new Date() : version.publishedAt,
        },
      });

      await tx.rankingEntry.deleteMany({ where: { versionId: version.id } });
      await tx.rankingEntry.createMany({
        data: entriesToCreate.map((e) => ({
          versionId: version.id,
          fighterId: e.fighterId,
          rank: e.rank,
          isChampion: e.isChampion,
          points: e.points,
        })),
      });

      const isLive = version.status === "PUBLISHED" || canPublish;
      if (isLive) {
        await tx.fighterRanking.deleteMany({ where: { scopeKey: version.scopeKey } });
        await tx.fighterRanking.createMany({
          data: entriesToCreate.map((e) => ({
            fighterId: e.fighterId,
            scopeKey: version.scopeKey,
            versionId: version.id,
            rank: e.rank,
            isChampion: e.isChampion,
          })),
        });
      }
    });

    revalidatePath("/admin/rankings");
    revalidatePath("/rankings");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function publishRankingVersionAction(versionId: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("rankings.publish");

    const version = await prisma.rankingVersion.findUnique({
      where: { id: versionId },
      include: { entries: true },
    });
    if (!version) {
      return { ok: false, error: "Versi peringkat tidak ditemukan" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.rankingVersion.updateMany({
        where: { scopeKey: version.scopeKey, status: "PUBLISHED", id: { not: version.id } },
        data: { status: "SUPERSEDED" },
      });

      await tx.rankingVersion.update({
        where: { id: version.id },
        data: {
          status: "PUBLISHED",
          approvedById: user.id,
          publishedAt: new Date(),
        },
      });

      await tx.fighterRanking.deleteMany({ where: { scopeKey: version.scopeKey } });
      if (version.entries.length > 0) {
        await tx.fighterRanking.createMany({
          data: version.entries.map((e) => ({
            fighterId: e.fighterId,
            scopeKey: version.scopeKey,
            versionId: version.id,
            rank: e.rank,
            isChampion: e.isChampion,
          })),
        });
      }
    });

    revalidatePath("/admin/rankings");
    revalidatePath("/rankings");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function deleteRankingVersionAction(versionId: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("rankings.manage");

    await prisma.rankingVersion.delete({ where: { id: versionId } });

    revalidatePath("/admin/rankings");
    revalidatePath("/rankings");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
