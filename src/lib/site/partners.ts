/**
 * Partner & supporter registry — the single source of truth for the "official event"
 * block on the public site.
 *
 * Nothing here renders unless it is listed in this file. That is deliberate: the
 * public pages must never imply an endorsement, sanction, or government backing that
 * the organiser cannot document. Every claim on the site comes from this list.
 *
 * ── Adding a partner ─────────────────────────────────────────────────────────────
 * 1. Drop the logo file in `public/images/partners/` (PNG with transparent background,
 *    at least 400px wide; SVG also works).
 * 2. Add an entry below with `logo: "/images/partners/<file>"`.
 * 3. Confirm the organiser has written permission to display the mark, and record the
 *    date/permission in `note` so the claim stays auditable.
 *
 * Entries without a `logo` render their `shortName` monogram instead, so the section
 * still looks intentional before artwork arrives — and never shows a fake crest.
 */

export type PartnerTier = "SUPPORTED_BY" | "PRESENTED_BY" | "OFFICIAL_PARTNER" | "MEDIA_PARTNER";

export type PartnerKind = "government" | "company" | "media" | "community";

export interface Partner {
  /** Stable slug, used for React keys and analytics. */
  id: string;
  /** Legal / official name, shown to the audience. */
  name: string;
  /** 2–4 character monogram used when `logo` is not set (e.g. "PEMKAB"). */
  shortName: string;
  tier: PartnerTier;
  kind: PartnerKind;
  /** Path under /public, e.g. "/images/partners/pemkab-temanggung.png". */
  logo?: string;
  /** Public-facing description of the relationship, per language. */
  note: { id: string; en: string };
  /** Optional outbound link (only add a URL you have verified is official). */
  href?: string;
}

/** The organiser itself — shown as the presenting party, not as a sponsor. */
export const ORGANIZER = {
  name: "Temanggung Fight Night",
  shortName: "TFN",
} as const;

/**
 * Government backing. The organiser has stated that Temanggung Fight Night is
 * officially supported by the regency government; this entry is that claim, in one
 * place, so it can be reviewed and (if it ever lapses) removed without touching JSX.
 */
export const GOVERNMENT_SUPPORTERS: Partner[] = [
  {
    id: "pemkab-temanggung",
    name: "Pemerintah Kabupaten Temanggung",
    shortName: "PEMKAB",
    tier: "SUPPORTED_BY",
    kind: "government",
    note: {
      id: "Dukungan resmi pemerintah daerah untuk penyelenggaraan TFN di Kabupaten Temanggung.",
      en: "Official regional-government support for TFN in Temanggung Regency.",
    },
    /**
     * Crest provenance (keep this auditable):
     * - Artwork: "Lambang Kabupaten Temanggung" per Perda Kab. Temanggung 27 Maret 1968 No. 32a,
     *   vector redraw from Wikimedia Commons (`File:Seal of Temanggung Regency.svg`), public domain.
     * - Cross-checked against the emblem published on temanggungkab.go.id.
     * - Rasterised to 640×968 PNG (transparent) with sharp; source SVG kept in docs/partners/.
     * Replace with the press-kit file from the regency's protocol office if they supply one.
     */
    logo: "/images/partners/pemkab-temanggung.png",
    href: "https://temanggungkab.go.id",
  },
];

/**
 * Commercial, community, and media partners.
 * Empty by design — fill in as agreements are signed. No placeholder brands.
 */
export const PARTNERS: Partner[] = [
  // {
  //   id: "contoh-sponsor",
  //   name: "Nama Perusahaan",
  //   shortName: "ABC",
  //   tier: "OFFICIAL_PARTNER",
  //   kind: "company",
  //   logo: "/images/partners/nama-perusahaan.png",
  //   note: { id: "Partner resmi TFN 2026.", en: "Official TFN 2026 partner." },
  // },
];

export const ALL_PARTNERS: Partner[] = [...GOVERNMENT_SUPPORTERS, ...PARTNERS];

/** Partners in a given tier — the UI skips tiers that come back empty. */
export function partnersByTier(tier: PartnerTier): Partner[] {
  return ALL_PARTNERS.filter((partner) => partner.tier === tier);
}

/** True when the event has at least one documented government supporter. */
export function hasGovernmentSupport(): boolean {
  return GOVERNMENT_SUPPORTERS.length > 0;
}
