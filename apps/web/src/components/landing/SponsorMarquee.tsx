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

// ── Placeholder visual (hanya tampil saat DB kosong) ─────────────────────────
// Ganti / hapus begitu logo asli tersedia di admin CMS.
interface PlaceholderItem {
  id: string;
  name: string;
  tier: SponsorTierKey;
  logoUrl: string;
  url: string | null;
}

const PLACEHOLDER_SPONSORS: PlaceholderItem[] = [
  { id: "ph-nike",      name: "Nike",           tier: "PLATINUM",     logoUrl: "https://logo.clearbit.com/nike.com",        url: null },
  { id: "ph-adidas",    name: "Adidas",         tier: "GOLD",         logoUrl: "https://logo.clearbit.com/adidas.com",      url: null },
  { id: "ph-bri",       name: "Bank BRI",       tier: "GOLD",         logoUrl: "https://logo.clearbit.com/bri.co.id",       url: null },
  { id: "ph-telkom",    name: "Telkom",         tier: "SILVER",       logoUrl: "https://logo.clearbit.com/telkom.co.id",    url: null },
  { id: "ph-gojek",     name: "Gojek",          tier: "PARTNER",      logoUrl: "https://logo.clearbit.com/gojek.com",       url: null },
  { id: "ph-grab",      name: "Grab",           tier: "MEDIA_PARTNER",logoUrl: "https://logo.clearbit.com/grab.com",        url: null },
  { id: "ph-tokopedia", name: "Tokopedia",      tier: "PARTNER",      logoUrl: "https://logo.clearbit.com/tokopedia.com",   url: null },
  { id: "ph-shopee",    name: "Shopee",         tier: "MEDIA_PARTNER",logoUrl: "https://logo.clearbit.com/shopee.co.id",    url: null },
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
  const inner = (
    <div className="group flex h-20 w-44 flex-col items-center justify-center gap-2 border border-subtle bg-charcoal px-4 py-3 transition-all duration-300 hover:border-fight-red hover:bg-charcoal/80">
      {/* Logo atau monogram */}
      <div className="relative flex h-9 w-full items-center justify-center">
        {sponsor.logoUrl ? (
          <Image
            src={sponsor.logoUrl}
            alt={`Logo ${sponsor.name}`}
            width={80}
            height={36}
            className="max-h-9 w-auto max-w-[80px] object-contain grayscale transition-all duration-300 group-hover:grayscale-0"
            unoptimized
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center border border-subtle bg-canvas font-mono-data text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {sponsor.name.slice(0, 3)}
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

  return (
    <section
      aria-labelledby="sponsor-marquee-title"
      className="border-y border-subtle bg-canvas-deep py-14 transition-colors sm:py-16"
    >
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 inline-block border border-fight-red px-2 py-0.5 font-mono-data text-[10px] font-bold uppercase tracking-[0.2em] text-fight-red">
              {lang === "id" ? "Didukung Oleh" : "Supported By"}
            </p>
            <h2
              id="sponsor-marquee-title"
              className="font-display text-2xl font-black uppercase tracking-tight text-ink sm:text-3xl"
            >
              {lang === "id" ? "Partner & Sponsor" : "Partner & Sponsor"}
            </h2>
          </div>

          <a
            href="mailto:info@tfn.id"
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

      {/* Footer note */}
      <p className="mx-auto mt-8 max-w-7xl px-4 font-mono-data text-[9px] uppercase tracking-[0.2em] text-ink-subtle sm:px-6 lg:px-8">
        {sponsors.length === 0
          ? lang === "id"
            ? "⚠ Data placeholder — tambahkan sponsor via Admin CMS"
            : "⚠ Placeholder data — add sponsors via Admin CMS"
          : lang === "id"
            ? "★ Slot sponsor tersedia — hubungi panitia untuk informasi kemitraan"
            : "★ Sponsor slots available — contact the committee for partnership info"}
      </p>
    </section>
  );
}



