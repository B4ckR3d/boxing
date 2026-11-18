"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { DomainValidationError, actionError, type ActionResult } from "@/lib/actions/result";
import {
  DEFAULT_SPONSOR_TIER,
  SPONSOR_TIER_KEYS,
  isSafeLogoSource,
  normalizeSponsorTier,
} from "@/lib/sponsors/tiers";

export interface SponsorInput {
  name: string;
  tier: string;
  url?: string;
  logoUrl?: string;
  sortOrder?: number;
  isActive: boolean;
}

const PUBLIC_PATHS = ["/"];

function revalidateSponsorPaths() {
  revalidatePath("/admin/sponsors");
  for (const path of PUBLIC_PATHS) revalidatePath(path);
}

function normalizeWebsite(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0) return null;
  if (isSafeLogoSource(trimmed)) return trimmed;
  // Domain tanpa skema (contoh: "sponsor.co.id") dinormalisasi ke https.
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  throw new DomainValidationError("URL situs sponsor tidak valid");
}

function validateInput(input: SponsorInput) {
  const name = input.name?.trim() ?? "";
  if (name.length === 0) throw new DomainValidationError("Nama sponsor wajib diisi");
  if (name.length > 120) throw new DomainValidationError("Nama sponsor maksimal 120 karakter");

  const rawTier = (input.tier ?? "").trim().toUpperCase();
  if (rawTier.length > 0 && !(SPONSOR_TIER_KEYS as string[]).includes(rawTier)) {
    throw new DomainValidationError("Tier sponsor tidak dikenal");
  }
  const tier = rawTier.length === 0 ? DEFAULT_SPONSOR_TIER : normalizeSponsorTier(rawTier);

  const logoUrl = (input.logoUrl ?? "").trim();
  if (logoUrl.length > 0 && !isSafeLogoSource(logoUrl)) {
    throw new DomainValidationError("Logo harus berupa path lokal (/images/...) atau URL http(s)");
  }

  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Math.trunc(Number(input.sortOrder)) : 0;

  return {
    name,
    tier: tier ?? DEFAULT_SPONSOR_TIER,
    logoUrl: logoUrl.length > 0 ? logoUrl : null,
    url: normalizeWebsite(input.url),
    sortOrder,
    isActive: Boolean(input.isActive),
  };
}

/**
 * Logo disimpan sebagai MediaAsset (pola sama dengan hero slide): admin cukup
 * menempelkan path hasil upload (`/images/sponsors/foo.png`) atau URL absolut.
 */
async function createLogoAsset(logoUrl: string, sponsorName: string): Promise<string> {
  const asset = await prisma.mediaAsset.create({
    data: {
      storageKey: `sponsor-logo-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      url: logoUrl,
      kind: "IMAGE",
      mimeType: "image/png",
      sizeBytes: 1024,
      originalName: `${sponsorName.slice(0, 80)}-logo.png`,
      alt: `Logo ${sponsorName}`,
      checksum: "0000000000000000000000000000000000000000000000000000000000000000",
    },
  });
  return asset.id;
}

export async function createSponsorAction(input: SponsorInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("content.manage");

    const data = validateInput(input);
    const logoId = data.logoUrl ? await createLogoAsset(data.logoUrl, data.name) : null;

    await prisma.sponsor.create({
      data: {
        name: data.name,
        tier: data.tier,
        url: data.url,
        logoId,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });

    revalidateSponsorPaths();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateSponsorAction(id: string, input: SponsorInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("content.manage");

    const existing = await prisma.sponsor.findUnique({ where: { id }, include: { logo: true } });
    if (!existing) return { ok: false, error: "Sponsor tidak ditemukan" };

    const data = validateInput(input);
    const logoId =
      data.logoUrl && data.logoUrl !== existing.logo?.url
        ? await createLogoAsset(data.logoUrl, data.name)
        : existing.logoId;

    await prisma.sponsor.update({
      where: { id },
      data: {
        name: data.name,
        tier: data.tier,
        url: data.url,
        logoId,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });

    revalidateSponsorPaths();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function toggleSponsorActiveAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("content.manage");

    const sponsor = await prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) return { ok: false, error: "Sponsor tidak ditemukan" };

    await prisma.sponsor.update({ where: { id }, data: { isActive: !sponsor.isActive } });

    revalidateSponsorPaths();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function deleteSponsorAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("content.manage");

    await prisma.sponsor.delete({ where: { id } });

    revalidateSponsorPaths();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

/** Geser urutan tampil tanpa perlu mengedit angka sort order manual. */
export async function moveSponsorAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("content.manage");

    const current = await prisma.sponsor.findUnique({ where: { id } });
    if (!current) return { ok: false, error: "Sponsor tidak ditemukan" };

    const neighbours = await prisma.sponsor.findMany({
      where: {
        id: { not: id },
        sortOrder:
          direction === "up" ? { lte: current.sortOrder } : { gte: current.sortOrder },
      },
      orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
      take: 1,
    });

    const neighbour = neighbours[0];
    if (!neighbour) return { ok: true };

    await prisma.$transaction([
      prisma.sponsor.update({ where: { id: current.id }, data: { sortOrder: neighbour.sortOrder } }),
      prisma.sponsor.update({ where: { id: neighbour.id }, data: { sortOrder: current.sortOrder } }),
    ]);

    revalidateSponsorPaths();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
