"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { DomainValidationError, actionError, type ActionResult } from "@/lib/actions/result";

export interface CreateTournamentInput {
  name: string;
  weightClassId: string;
  format: "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION";
  status: "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  size: number;
  prize?: string;
  titleAwarded?: string;
  description?: string;
  posterId?: string | null;
  startDate?: string;
  isPublished: boolean;
  participantFighterIds: string[];
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "grand-prix"
  );
}

export async function createTournamentAction(input: CreateTournamentInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("tournaments.manage");

    const name = input.name?.trim() ?? "";
    if (!name) throw new DomainValidationError("Nama turnamen wajib diisi");
    if (!input.weightClassId) throw new DomainValidationError("Divisi kelas berat wajib dipilih");

    const allowedSizes = [4, 8, 16, 32];
    const size = allowedSizes.includes(Number(input.size)) ? Number(input.size) : 8;
    const rounds = Math.round(Math.log2(size));

    const slug = `${slugify(name).slice(0, 140)}-${Date.now().toString().slice(-4)}`;
    const uniqueFighterIds = [...new Set((input.participantFighterIds ?? []).filter(Boolean))].slice(0, size);

    const startDate = input.startDate ? new Date(input.startDate) : null;
    const validStartDate = startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;

    await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          name: name.slice(0, 160),
          slug,
          weightClassId: input.weightClassId,
          format: input.format === "DOUBLE_ELIMINATION" ? "DOUBLE_ELIMINATION" : "SINGLE_ELIMINATION",
          status: input.status || "REGISTRATION",
          size,
          prize: input.prize?.trim().slice(0, 255) || null,
          titleAwarded: input.titleAwarded?.trim().slice(0, 160) || null,
          description: input.description?.trim() || null,
          posterId: input.posterId || null,
          startDate: validStartDate,
          isPublished: Boolean(input.isPublished),
        },
      });

      if (uniqueFighterIds.length > 0) {
        await tx.tournamentParticipant.createMany({
          data: uniqueFighterIds.map((fighterId, idx) => ({
            tournamentId: tournament.id,
            fighterId,
            seed: idx + 1,
            status: "ACTIVE",
          })),
        });
      }

      const bracket = await tx.tournamentBracket.create({
        data: {
          tournamentId: tournament.id,
          type: "WINNERS",
          name: "Main Bracket",
          rounds,
        },
      });

      const participants = await tx.tournamentParticipant.findMany({
        where: { tournamentId: tournament.id },
        orderBy: { seed: "asc" },
      });
      const p1 = participants.find((p) => p.seed === 1);
      const p2 = participants.find((p) => p.seed === 2);
      const p3 = participants.find((p) => p.seed === 3);
      const p4 = participants.find((p) => p.seed === 4);

      await tx.tournamentBout.create({
        data: {
          bracketId: bracket.id,
          round: 1,
          position: 1,
          participantAId: p1?.id ?? null,
          participantBId: p4?.id ?? null,
          status: "READY",
        },
      });

      await tx.tournamentBout.create({
        data: {
          bracketId: bracket.id,
          round: 1,
          position: 2,
          participantAId: p2?.id ?? null,
          participantBId: p3?.id ?? null,
          status: "READY",
        },
      });
    });

    revalidatePath("/admin/grand-prix");
    revalidatePath("/grand-prix");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function toggleTournamentPublishAction(
  id: string,
  isPublished: boolean,
): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("tournaments.manage");

    await prisma.tournament.update({
      where: { id },
      data: { isPublished },
    });

    revalidatePath("/admin/grand-prix");
    revalidatePath("/grand-prix");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateTournamentAction(input: {
  id: string;
  name: string;
  weightClassId: string;
  format: "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION";
  status: "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  size: number;
  prize?: string;
  titleAwarded?: string;
  description?: string;
  posterId?: string | null;
  startDate?: string;
  isPublished: boolean;
  participantFighterIds?: string[];
}): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("tournaments.manage");

    const name = input.name?.trim() ?? "";
    if (!name) throw new DomainValidationError("Nama turnamen wajib diisi");
    if (!input.weightClassId) throw new DomainValidationError("Divisi kelas berat wajib dipilih");

    const allowedSizes = [4, 8, 16, 32];
    const size = allowedSizes.includes(Number(input.size)) ? Number(input.size) : 8;

    const startDate = input.startDate ? new Date(input.startDate) : null;
    const validStartDate = startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;

    const uniqueFighterIds = input.participantFighterIds
      ? [...new Set(input.participantFighterIds.filter(Boolean))].slice(0, size)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.tournament.update({
        where: { id: input.id },
        data: {
          name: name.slice(0, 160),
          weightClassId: input.weightClassId,
          format: input.format === "DOUBLE_ELIMINATION" ? "DOUBLE_ELIMINATION" : "SINGLE_ELIMINATION",
          status: input.status || "REGISTRATION",
          size,
          prize: input.prize?.trim().slice(0, 255) || null,
          titleAwarded: input.titleAwarded?.trim().slice(0, 160) || null,
          description: input.description?.trim() || null,
          posterId: input.posterId === undefined ? undefined : input.posterId,
          startDate: validStartDate,
          isPublished: Boolean(input.isPublished),
        },
      });

      if (uniqueFighterIds !== null) {
        await tx.tournamentParticipant.deleteMany({ where: { tournamentId: input.id } });
        if (uniqueFighterIds.length > 0) {
          await tx.tournamentParticipant.createMany({
            data: uniqueFighterIds.map((fighterId, idx) => ({
              tournamentId: input.id,
              fighterId,
              seed: idx + 1,
              status: "ACTIVE",
            })),
          });
        }

        const bracket = await tx.tournamentBracket.findFirst({
          where: { tournamentId: input.id },
        });
        if (bracket) {
          const participants = await tx.tournamentParticipant.findMany({
            where: { tournamentId: input.id },
            orderBy: { seed: "asc" },
          });
          const p1 = participants.find((p) => p.seed === 1);
          const p2 = participants.find((p) => p.seed === 2);
          const p3 = participants.find((p) => p.seed === 3);
          const p4 = participants.find((p) => p.seed === 4);

          const existingBout1 = await tx.tournamentBout.findFirst({
            where: { bracketId: bracket.id, round: 1, position: 1 },
          });
          if (existingBout1) {
            await tx.tournamentBout.update({
              where: { id: existingBout1.id },
              data: {
                participantAId: p1?.id ?? null,
                participantBId: p4?.id ?? null,
              },
            });
          } else {
            await tx.tournamentBout.create({
              data: {
                bracketId: bracket.id,
                round: 1,
                position: 1,
                participantAId: p1?.id ?? null,
                participantBId: p4?.id ?? null,
                status: "READY",
              },
            });
          }

          const existingBout2 = await tx.tournamentBout.findFirst({
            where: { bracketId: bracket.id, round: 1, position: 2 },
          });
          if (existingBout2) {
            await tx.tournamentBout.update({
              where: { id: existingBout2.id },
              data: {
                participantAId: p2?.id ?? null,
                participantBId: p3?.id ?? null,
              },
            });
          } else {
            await tx.tournamentBout.create({
              data: {
                bracketId: bracket.id,
                round: 1,
                position: 2,
                participantAId: p2?.id ?? null,
                participantBId: p3?.id ?? null,
                status: "READY",
              },
            });
          }
        }
      }
    });

    revalidatePath("/admin/grand-prix");
    revalidatePath("/grand-prix");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateTournamentStatusAction(
  id: string,
  status: "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("tournaments.manage");

    await prisma.tournament.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/admin/grand-prix");
    revalidatePath("/grand-prix");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function deleteTournamentAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("tournaments.manage");

    await prisma.tournament.delete({ where: { id } });

    revalidatePath("/admin/grand-prix");
    revalidatePath("/grand-prix");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
