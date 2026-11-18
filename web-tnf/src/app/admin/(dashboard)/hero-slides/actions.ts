"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";

export interface CreateHeroSlideInput {
  eventTitle: string;
  headline: string;
  description?: string;
  eventDate?: string;
  fighterImageUrl?: string;
  backgroundImageUrl?: string;
  ctaPrimaryLabel?: string;
  ctaPrimaryHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  sortOrder?: number;
  isActive: boolean;
}

export async function createHeroSlideAction(input: CreateHeroSlideInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("content.manage");

    if (!input.headline || input.headline.trim().length === 0) {
      return { ok: false, error: "Headline slide wajib diisi" };
    }

    let fighterImageId: string | undefined = undefined;
    if (input.fighterImageUrl && input.fighterImageUrl.trim().length > 0) {
      const asset = await prisma.mediaAsset.create({
        data: {
          storageKey: `hero-fighter-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          url: input.fighterImageUrl.trim(),
          kind: "IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          originalName: "fighter-hero.jpg",
          checksum: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      });
      fighterImageId = asset.id;
    }

    let backgroundId: string | undefined = undefined;
    if (input.backgroundImageUrl && input.backgroundImageUrl.trim().length > 0) {
      const bgAsset = await prisma.mediaAsset.create({
        data: {
          storageKey: `hero-bg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          url: input.backgroundImageUrl.trim(),
          kind: "IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          originalName: "hero-bg.jpg",
          checksum: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      });
      backgroundId = bgAsset.id;
    }

    await prisma.heroSlide.create({
      data: {
        eventTitle: input.eventTitle?.trim() || "TFN 01 · GEDUNG PEMUDA TEMANGGUNG",
        headline: input.headline.trim(),
        description: input.description?.trim() || null,
        eventDate: input.eventDate ? new Date(input.eventDate) : new Date("2026-12-24T19:00:00Z"),
        fighterImageId,
        backgroundId,
        ctaPrimaryLabel: input.ctaPrimaryLabel?.trim() || "BACA SELENGKAPNYA",
        ctaPrimaryHref: input.ctaPrimaryHref?.trim() || "/events",
        ctaSecondaryLabel: input.ctaSecondaryLabel?.trim() || "LIHAT FIGHT CARD",
        ctaSecondaryHref: input.ctaSecondaryHref?.trim() || "/rankings",
        sortOrder: Number(input.sortOrder) || 0,
        isActive: Boolean(input.isActive),
        overlay: "DARK",
      },
    });

    revalidatePath("/admin/hero-slides");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function toggleActiveHeroSlideAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("content.manage");

    const slide = await prisma.heroSlide.findUnique({ where: { id } });
    if (!slide) {
      return { ok: false, error: "Slide tidak ditemukan" };
    }

    await prisma.heroSlide.update({
      where: { id },
      data: { isActive: !slide.isActive },
    });

    revalidatePath("/admin/hero-slides");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function deleteHeroSlideAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("content.manage");

    await prisma.heroSlide.delete({
      where: { id },
    });

    revalidatePath("/admin/hero-slides");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

