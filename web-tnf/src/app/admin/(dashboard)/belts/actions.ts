"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { DomainValidationError, actionError, type ActionResult } from "@/lib/actions/result";

export interface CreateBeltInput {
  name: string;
  weightClassId: string;
  description?: string;
  status: "ACTIVE" | "VACANT" | "SUSPENDED" | "RETIRED";
  imageId?: string | null;
  holderFighterId?: string;
  wonAt?: string;
  nextDefenseNote?: string;
  sortOrder?: number;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "belt"
  );
}

export async function createBeltAction(input: CreateBeltInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("belts.manage");

    const name = input.name?.trim() ?? "";
    if (!name) throw new DomainValidationError("Nama sabuk wajib diisi");
    if (!input.weightClassId) throw new DomainValidationError("Divisi kelas berat wajib dipilih");

    const slug = `${slugify(name).slice(0, 100)}-${Date.now().toString().slice(-4)}`;
    const hasHolder = Boolean(input.holderFighterId);
    const status = hasHolder ? "ACTIVE" : input.status || "VACANT";

    const wonDate = input.wonAt ? new Date(input.wonAt) : new Date();
    const validWonDate = Number.isNaN(wonDate.getTime()) ? new Date() : wonDate;

    await prisma.$transaction(async (tx) => {
      const belt = await tx.championshipBelt.create({
        data: {
          name: name.slice(0, 120),
          slug,
          weightClassId: input.weightClassId,
          description: input.description?.trim() || null,
          status,
          imageId: input.imageId || null,
          nextDefenseNote: input.nextDefenseNote?.trim().slice(0, 255) || null,
          sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.trunc(Number(input.sortOrder)) : 0,
        },
      });

      if (input.holderFighterId) {
        await tx.beltReign.create({
          data: {
            beltId: belt.id,
            fighterId: input.holderFighterId,
            status: "ACTIVE",
            activeKey: belt.id,
            wonAt: validWonDate,
            proposedById: user.id,
            approvedById: user.id,
            approvedAt: new Date(),
          },
        });
      }
    });

    revalidatePath("/admin/belts");
    revalidatePath("/belts");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateBeltHolderAction(
  beltId: string,
  fighterId: string | null,
): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("belts.manage");

    const belt = await prisma.championshipBelt.findUnique({ where: { id: beltId } });
    if (!belt) return { ok: false, error: "Sabuk tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      await tx.beltReign.updateMany({
        where: { beltId, status: "ACTIVE" },
        data: {
          status: "ENDED",
          activeKey: null,
          endedAt: new Date(),
          endReason: fighterId ? "LOST" : "VACATED",
        },
      });

      if (fighterId) {
        await tx.beltReign.create({
          data: {
            beltId,
            fighterId,
            status: "ACTIVE",
            activeKey: beltId,
            wonAt: new Date(),
            proposedById: user.id,
            approvedById: user.id,
            approvedAt: new Date(),
          },
        });
        await tx.championshipBelt.update({
          where: { id: beltId },
          data: { status: "ACTIVE" },
        });
      } else {
        await tx.championshipBelt.update({
          where: { id: beltId },
          data: { status: "VACANT" },
        });
      }
    });

    revalidatePath("/admin/belts");
    revalidatePath("/belts");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function deleteBeltAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("belts.manage");

    await prisma.championshipBelt.delete({ where: { id } });

    revalidatePath("/admin/belts");
    revalidatePath("/belts");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
