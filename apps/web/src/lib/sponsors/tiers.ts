/**
 * Tier sponsor dipakai bersama oleh admin CMS dan tampilan publik.
 * Disimpan di kolom `Sponsor.tier` (VarChar) — nilai tak dikenal dinormalisasi
 * ke `PARTNER` agar data lama tidak pernah merusak render beranda.
 */
export const SPONSOR_TIERS = [
  { key: "PLATINUM", id: "Sponsor Platinum", en: "Platinum sponsors" },
  { key: "GOLD", id: "Sponsor Gold", en: "Gold sponsors" },
  { key: "SILVER", id: "Sponsor Silver", en: "Silver sponsors" },
  { key: "PARTNER", id: "Mitra pendukung", en: "Supporting partners" },
  { key: "MEDIA_PARTNER", id: "Media partner", en: "Media partners" },
] as const;

export type SponsorTierKey = (typeof SPONSOR_TIERS)[number]["key"];

export const SPONSOR_TIER_KEYS = SPONSOR_TIERS.map((tier) => tier.key) as SponsorTierKey[];

export const DEFAULT_SPONSOR_TIER: SponsorTierKey = "PARTNER";

/** Urutan tampil tier di beranda: platinum paling atas. */
export const SPONSOR_TIER_ORDER: Record<SponsorTierKey, number> = {
  PLATINUM: 0,
  GOLD: 1,
  SILVER: 2,
  PARTNER: 3,
  MEDIA_PARTNER: 4,
};

export function normalizeSponsorTier(value: string | null | undefined): SponsorTierKey {
  const upper = (value ?? "").trim().toUpperCase();
  return (SPONSOR_TIER_KEYS as string[]).includes(upper)
    ? (upper as SponsorTierKey)
    : DEFAULT_SPONSOR_TIER;
}

export function sponsorTierLabel(tier: SponsorTierKey, lang: "id" | "en"): string {
  const found = SPONSOR_TIERS.find((item) => item.key === tier);
  if (!found) return lang === "en" ? "Supporting partners" : "Mitra pendukung";
  return lang === "en" ? found.en : found.id;
}

/**
 * Logo sponsor boleh berupa path lokal (/images/sponsors/logo.png) atau URL absolut.
 * Nilai lain ditolak agar tidak ada javascript:/data: yang lolos ke <img src>.
 */
export function isSafeLogoSource(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return false;
  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
