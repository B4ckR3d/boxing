/**
 * Sponsor publik — proyeksi baca-saja untuk beranda.
 *
 * Pindah dari `apps/web`. Aturan tampil dipertahankan persis:
 *   - hanya `isActive`,
 *   - logo yang sudah di-soft-delete tidak pernah dikirim (URL jadi null),
 *   - urut `sortOrder` lalu `name`,
 *   - tier tak dikenal dinormalisasi ke `PARTNER` agar data lama tidak merusak render.
 *
 * Tanpa sponsor aktif, hasilnya array kosong — beranda tidak pernah menampilkan logo palsu.
 */
import type { PrismaClient } from "@tfn/db/client";
import { normalizeSponsorTier, type SponsorTierKey } from "./sponsor-tiers";

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Db = PrismaClient | Tx;

export interface PublicSponsor {
  id: string;
  name: string;
  url: string | null;
  tier: SponsorTierKey;
  logoUrl: string | null;
}

export async function getPublicSponsors(db: Db): Promise<PublicSponsor[]> {
  const rows = await db.sponsor.findMany({
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
