"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { DomainValidationError, actionError, type ActionResult } from "@/lib/actions/result";

export interface FighterInput {
  firstName: string;
  lastName: string;
  ringName?: string;
  gender: "MALE" | "FEMALE";
  nationality?: string;
  hometown?: string;
  heightCm?: number | null;
  reachCm?: number | null;
  stance: "ORTHODOX" | "SOUTHPAW" | "SWITCH";
  weightClassId: string;
  status: "ACTIVE" | "INACTIVE" | "RETIRED" | "SUSPENDED";
  wins?: number;
  losses?: number;
  draws?: number;
  koWins?: number;
  bio?: string;
  portraitId?: string | null;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "fighter"
  );
}

function toIntOrZero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

function toOptionalPositiveInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export async function createFighterAction(input: FighterInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("fighters.create");

    const firstName = input.firstName?.trim() ?? "";
    const lastName = input.lastName?.trim() ?? "";
    if (!firstName || !lastName) {
      throw new DomainValidationError("Nama depan dan nama belakang petarung wajib diisi");
    }
    if (!input.weightClassId) {
      throw new DomainValidationError("Divisi kelas berat wajib dipilih");
    }

    const baseSlug = slugify(`${firstName}-${lastName}`).slice(0, 100);
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    const nationality = (input.nationality?.trim().toUpperCase() || "ID").slice(0, 2);

    const wins = toIntOrZero(input.wins);
    const losses = toIntOrZero(input.losses);
    const draws = toIntOrZero(input.draws);
    const koWins = Math.min(toIntOrZero(input.koWins), wins);

    const created = await prisma.fighter.create({
      data: {
        slug,
        firstName: firstName.slice(0, 80),
        lastName: lastName.slice(0, 80),
        ringName: input.ringName?.trim().slice(0, 80) || null,
        gender: input.gender === "FEMALE" ? "FEMALE" : "MALE",
        nationality,
        hometown: input.hometown?.trim().slice(0, 120) || null,
        heightCm: toOptionalPositiveInt(input.heightCm),
        reachCm: toOptionalPositiveInt(input.reachCm),
        stance: input.stance || "ORTHODOX",
        weightClassId: input.weightClassId,
        status: input.status || "ACTIVE",
        bio: input.bio?.trim() || null,
        portraitId: input.portraitId || null,
        baseWins: wins,
        baseLosses: losses,
        baseDraws: draws,
        baseKoWins: koWins,
        wins,
        losses,
        draws,
        koWins,
      },
    });

    revalidatePath("/admin/fighters");
    revalidatePath("/fighters");
    revalidatePath("/");
    return { ok: true, id: created.id };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateFighterAction(id: string, input: FighterInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("fighters.update");

    const existing = await prisma.fighter.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return { ok: false, error: "Petarung tidak ditemukan" };
    }

    const firstName = input.firstName?.trim() ?? "";
    const lastName = input.lastName?.trim() ?? "";
    if (!firstName || !lastName) {
      throw new DomainValidationError("Nama depan dan nama belakang petarung wajib diisi");
    }

    const nationality = (input.nationality?.trim().toUpperCase() || "ID").slice(0, 2);
    const wins = toIntOrZero(input.wins);
    const losses = toIntOrZero(input.losses);
    const draws = toIntOrZero(input.draws);
    const koWins = Math.min(toIntOrZero(input.koWins), wins);

    await prisma.fighter.update({
      where: { id },
      data: {
        firstName: firstName.slice(0, 80),
        lastName: lastName.slice(0, 80),
        ringName: input.ringName?.trim().slice(0, 80) || null,
        gender: input.gender === "FEMALE" ? "FEMALE" : "MALE",
        nationality,
        hometown: input.hometown?.trim().slice(0, 120) || null,
        heightCm: toOptionalPositiveInt(input.heightCm),
        reachCm: toOptionalPositiveInt(input.reachCm),
        stance: input.stance || "ORTHODOX",
        weightClassId: input.weightClassId,
        status: input.status || "ACTIVE",
        bio: input.bio?.trim() || null,
        portraitId: input.portraitId === undefined ? existing.portraitId : input.portraitId,
        baseWins: wins,
        baseLosses: losses,
        baseDraws: draws,
        baseKoWins: koWins,
        wins,
        losses,
        draws,
        koWins,
      },
    });

    revalidatePath("/admin/fighters");
    revalidatePath("/fighters");
    revalidatePath(`/fighters/${existing.slug}`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function deleteFighterAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("fighters.delete");

    await prisma.fighter.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/admin/fighters");
    revalidatePath("/fighters");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
