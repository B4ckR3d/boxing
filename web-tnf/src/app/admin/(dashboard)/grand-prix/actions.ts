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

      await tx.tournamentBracket.create({
        data: {
          tournamentId: tournament.id,
          type: "WINNERS",
          name: "Main Bracket",
          rounds,
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
