"use client";

import React from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { sponsorTierLabel, type SponsorTierKey } from "@tfn/core/sponsor-tiers";
import type { PublicSponsor } from "@/server/services/sponsor.service";

/**
 * Sponsor marquee di bawah halaman beranda.
 *
 * Data dari DB via `getPublicSponsors()` di page.tsx — props `sponsors` wajib diisi.
 * Jika array kosong (belum ada sponsor di DB), fallback ke tile placeholder visual
 * sehingga marquee tidak kosong saat development atau sebelum data masuk.
 *
 * Animasi: `.tfn-ticker` di globals.css (dua paruh identik → loop mulus).
 * Otomatis berhenti saat `prefers-reduced-motion: reduce`.
 */

// ── Placeholder visual (hanya fallback saat DB kosong) ───────────────────────
interface PlaceholderItem {
  id: string;
  name: string;
  tier: SponsorTierKey;
  logoUrl: string | null;
  url: string | null;
}

const PLACEHOLDER_SPONSORS: PlaceholderItem[] = [
  { id: "ph-pemkab",      name: "Pemkab Temanggung",      tier: "PLATINUM",     logoUrl: "/images/partners/pemkab-temanggung.png",        url: "https://temanggungkab.go.id" },
  { id: "ph-kickboxing",  name: "Kickboxing Temanggung",  tier: "GOLD",         logoUrl: "/images/partners/kickboxing-temanggung.png",    url: null },
  { id: "ph-perbati",     name: "PERBATI Temanggung",     tier: "GOLD",         logoUrl: "/images/partners/perbati-temanggung.png",       url: null },
  { id: "ph-bri",         name: "Bank BRI",               tier: "GOLD",         logoUrl: null,                                            url: "https://bri.co.id" },
  { id: "ph-telkom",      name: "Telkom Indonesia",       tier: "SILVER",       logoUrl: null,                                            url: "https://telkom.co.id" },
  { id: "ph-tbc",         name: "Temanggung Boxing Camp", tier: "PARTNER",      logoUrl: null,                                            url: null },
  { id: "ph-gor",         name: "GOR Bambu Runcing",      tier: "PARTNER",      logoUrl: null,                                            url: null },
  { id: "ph-suara",       name: "Suara Temanggung",       tier: "MEDIA_PARTNER",logoUrl: null,                                            url: null },
  { id: "ph-megaswara",   name: "Radio Megaswara FM",     tier: "MEDIA_PARTNER",logoUrl: null,                                            url: null },
];

// ── Tile component ────────────────────────────────────────────────────────────

interface TileData {
  id: string;
  name: string;
  tier: SponsorTierKey;
  logoUrl: string | null;
  url: string | null;
}

function SponsorTile({ sponsor, lang }: { sponsor: TileData; lang: "id" | "en" }) {
  const tierLabel = sponsorTierLabel(sponsor.tier, lang);
  const [imgError, setImgError] = React.useState(false);

  const inner = (
    <div className="group flex h-20 w-48 flex-col items-center justify-center gap-1.5 border border-subtle bg-charcoal px-3 py-2.5 transition-all duration-300 hover:border-fight-red hover:bg-charcoal/80">
      {/* Logo atau typographic wordmark */}
      <div className="relative flex h-9 w-full items-center justify-center overflow-hidden">
        {sponsor.logoUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            onError={() => setImgError(true)}
            className="max-h-8 w-auto max-w-[110px] object-contain opacity-85 grayscale contrast-125 transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
          />
        ) : (
          <span className="font-display font-black text-xs uppercase tracking-wider text-ink/90 group-hover:text-fight-red transition-colors text-center px-1 truncate max-w-full">
            {sponsor.name}
          </span>
        )}
      </div>
      {/* Tier label */}
      <p className="font-mono-data text-[9px] font-bold uppercase tracking-[0.15em] text-ink-subtle transition-colors group-hover:text-ink">
        {tierLabel}
      </p>
    </div>
  );

  // Bungkus <a> jika ada URL, div biasa jika tidak.
  return (
    <li className="shrink-0">
      {sponsor.url ? (
        <a href={sponsor.url} target="_blank" rel="noopener noreferrer" aria-label={sponsor.name}>
          {inner}
        </a>
      ) : (
        inner
      )}
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SponsorMarqueeProps {
  /** Daftar sponsor aktif dari DB via getPublicSponsors(). Opsional — default [] → tampil placeholder. */
  sponsors?: PublicSponsor[];
}

export function SponsorMarquee({ sponsors = [] }: SponsorMarqueeProps) {
  const { lang } = useLanguage();

  // Gunakan data DB jika ada; fallback ke placeholder saat DB kosong.
  const tiles: TileData[] =
    sponsors.length > 0
      ? sponsors.map((s) => ({ ...s }))
      : PLACEHOLDER_SPONSORS;

  const waMessage =
    lang === "id"
      ? encodeURIComponent("Halo Admin TFN, saya tertarik untuk menjadi partner / sponsor Temanggung Fight Night.")
      : encodeURIComponent("Hello TFN Admin, I am interested in becoming a partner / sponsor for Temanggung Fight Night.");
  const waUrl = `https://wa.me/6285714883551?text=${waMessage}`;

  return (
    <section
      aria-labelledby="sponsor-marquee-title"
      className="border-y border-subtle bg-canvas-deep py-14 transition-colors sm:py-16"
    >
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="sponsor-marquee-title"
              className="font-display text-2xl font-black uppercase tracking-tight text-ink sm:text-3xl"
            >
              {lang === "id" ? "Partner & Sponsor" : "Partner & Sponsor"}
            </h2>
          </div>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start border border-dashed border-subtle px-4 font-mono-data text-[10px] font-bold uppercase tracking-[0.18em] text-ink-subtle transition-colors hover:border-fight-red hover:text-ink sm:self-auto"
          >
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            {lang === "id" ? "Jadi Mitra TFN" : "Become a Partner"}
          </a>
        </div>
      </div>

      {/* Marquee strip */}
      <div className="relative mt-10 overflow-hidden">
        {/* Edge fades */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-canvas-deep to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-canvas-deep to-transparent"
        />

        <div className="tfn-ticker" style={{ animationDuration: "60s" }}>
          <ul className="flex items-center gap-4 px-2">
            {tiles.map((s) => (
              <SponsorTile key={`a-${s.id}`} sponsor={s} lang={lang} />
            ))}
          </ul>
          <ul aria-hidden="true" className="flex items-center gap-4 px-2">
            {tiles.map((s) => (
              <SponsorTile key={`b-${s.id}`} sponsor={s} lang={lang} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}



