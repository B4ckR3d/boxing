import "server-only";
import { prisma } from "@/lib/db/prisma";
import { normalizeSponsorTier, type SponsorTierKey } from "@/lib/sponsors/tiers";

export interface PublicSponsor {
  id: string;
  name: string;
  url: string | null;
  tier: SponsorTierKey;
  logoUrl: string | null;
}

/**
 * Sponsor yang boleh tampil di beranda publik:
 * hanya `isActive`, hanya logo yang belum dihapus (soft delete MediaAsset),
 * urut sortOrder lalu nama. Tanpa sponsor aktif → array kosong, sehingga
 * beranda tidak pernah menampilkan logo palsu.
 */
export async function getPublicSponsors(): Promise<PublicSponsor[]> {
  const rows = await prisma.sponsor.findMany({
    where: {
      isActive: true,
      OR: [{ logoId: null }, { logo: { deletedAt: null } }],
    },
    include: { logo: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    tier: normalizeSponsorTier(row.tier),
    logoUrl: row.logo?.deletedAt ? null : row.logo?.url ?? null,
  }));
}
