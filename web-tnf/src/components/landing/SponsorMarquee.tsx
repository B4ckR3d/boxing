"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { sponsorTierLabel, type SponsorTierKey } from "@tfn/core/sponsor-tiers";
import type { PublicSponsor } from "@/server/services/sponsor.service";

/**
 * Sponsor marquee di bawah halaman beranda (tepat di atas footer).
 *
 * Menerima data sponsor aktif dari DB via `getPublicSponsors()`.
 * Jika kosong, fallback ke daftar placeholder resmi.
 *
 * FITUR UTAMA:
 * 1. True Infinite Loop: Daftar diulang (min. 18-24 item per paruh) sehingga
 *    lebar satu lintasan mencapai >5.000px. Tidak akan pernah ada celah kosong
 *    (black gap) pada layar 1080p, 1440p, hingga 4K ultrawide.
 * 2. Ukuran Kartu Lebih Besar & Gagah:
 *    Tinggi dinaikkan dari 80px ke 112px-144px (h-28 sm:h-32 md:h-36),
 *    lebar 240px-320px (w-60 sm:w-72 md:w-80), area logo lega (h-14 sampai h-20).
 * 3. Pause on Hover: Marquee otomatis berhenti saat mouse diarahkan ke atasnya.
 * 4. Dual-Theme Support: Kontras tajam dan estetis di Dark Mode maupun Light Mode.
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
    <div className="group/tile relative flex h-28 w-60 sm:h-32 sm:w-72 md:h-36 md:w-80 flex-col items-center justify-between border border-subtle bg-charcoal px-5 py-4 transition-all duration-300 hover:border-fight-red hover:bg-surface hover:shadow-xl hover:shadow-fight-red/10">
      {/* Tier label di pojok atas */}
      <div className="w-full flex items-center justify-between">
        <span className="font-mono-data text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-ink-subtle transition-colors group-hover/tile:text-fight-red">
          {tierLabel}
        </span>
        {sponsor.url && (
          <ArrowUpRight
            aria-hidden="true"
            className="h-3.5 w-3.5 text-ink-subtle opacity-0 transition-all duration-200 group-hover/tile:opacity-100 group-hover/tile:text-fight-red"
          />
        )}
      </div>

      {/* Area Logo / Typographic Wordmark */}
      <div className="relative flex h-14 sm:h-16 md:h-18 w-full items-center justify-center overflow-hidden px-2">
        {sponsor.logoUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            onError={() => setImgError(true)}
            className="max-h-12 sm:max-h-14 md:max-h-16 w-auto max-w-[170px] sm:max-w-[210px] md:max-w-[240px] object-contain opacity-85 grayscale contrast-125 transition-all duration-300 group-hover/tile:opacity-100 group-hover/tile:grayscale-0 group-hover/tile:scale-105"
          />
        ) : (
          <span className="font-display font-black text-sm sm:text-base md:text-lg uppercase tracking-wider text-ink transition-colors group-hover/tile:text-fight-red text-center px-2 line-clamp-2 max-w-full">
            {sponsor.name}
          </span>
        )}
      </div>

      {/* Garis aksen minimal di bawah */}
      <div className="w-8 h-0.5 bg-subtle transition-all duration-300 group-hover/tile:w-16 group-hover/tile:bg-fight-red" />
    </div>
  );

  return (
    <li className="shrink-0 list-none">
      {sponsor.url ? (
        <a
          href={sponsor.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={sponsor.name}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fight-red"
        >
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
  const baseTiles: TileData[] =
    sponsors.length > 0
      ? sponsors.map((s) => ({ ...s }))
      : PLACEHOLDER_SPONSORS;

  // Duplikasi baseTiles agar SATU PARUH lintasan (single pass) memiliki minimal 18-20 item.
  // Dengan lebar kartu 240-320px + gap 24px (~344px), 18 item = ~6.192px per paruh.
  // Ini MENJAMIN pada resolusi layar apa pun (1080p, 1440p, 4K ultrawide 3840px)
  // TIDAK AKAN PERNAH ada celah kosong (black gap), dan loop translateX(-50%) berjalan
  // 100% mulus tanpa patah/lompat (true infinite loop).
  const targetMinCount = 18;
  const repeatCount = Math.max(2, Math.ceil(targetMinCount / Math.max(1, baseTiles.length)));
  const displayTiles = Array.from({ length: repeatCount }, () => baseTiles).flat();

  // Durasi animasi proporsional terhadap jumlah item (smooth pacing, ~2.5 detik per kartu)
  const animDurationSeconds = Math.max(45, Math.round(displayTiles.length * 2.6));

  // WhatsApp TFN Admin (Kontak 2 resmi: +62 858-4800-0639)
  const waMessage =
    lang === "id"
      ? encodeURIComponent("Halo Admin TFN, saya tertarik untuk menjadi partner / sponsor Temanggung Fight Night.")
      : encodeURIComponent("Hello TFN Admin, I am interested in becoming a partner / sponsor for Temanggung Fight Night.");
  const waUrl = `https://wa.me/6285848000639?text=${waMessage}`;

  return (
    <section
      aria-labelledby="sponsor-marquee-title"
      className="tfn-sponsor-marquee group relative border-y border-subtle bg-canvas-deep py-14 transition-colors sm:py-20"
    >
      {/* Header section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-mono-data text-[11px] font-bold uppercase tracking-[0.22em] text-fight-red">
              {lang === "id" ? "KOLABORASI & DUKUNGAN" : "COLLABORATION & SUPPORT"}
            </span>
            <h2
              id="sponsor-marquee-title"
              className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-ink sm:text-3xl lg:text-4xl"
            >
              {lang === "id" ? "PARTNER & SPONSOR" : "PARTNERS & SPONSORS"}
            </h2>
          </div>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start border border-dashed border-subtle px-5 py-2.5 font-mono-data text-[11px] font-bold uppercase tracking-[0.18em] text-ink-subtle transition-colors hover:border-fight-red hover:text-ink sm:self-auto"
          >
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-fight-red" />
            {lang === "id" ? "JADI MITRA TFN" : "BECOME A PARTNER"}
          </a>
        </div>
      </div>

      {/* Marquee strip container */}
      <div className="relative mt-8 sm:mt-12 overflow-hidden select-none">
        {/* Edge gradient fades for clean entrance & exit */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 sm:w-40 bg-gradient-to-r from-canvas-deep to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 sm:w-40 bg-gradient-to-l from-canvas-deep to-transparent"
        />

        {/*
          TFN-TICKER INFINITE LOOP
          - Dua paruh identik (Track A dan Track B) masing-masing memiliki pr-6 (24px)
            dan gap-6 (24px) antar anak.
          - Jarak antara elemen terakhir Track A dan elemen pertama Track B tepat 24px.
          - Saat animasi translateX(-50%) selesai, Track B berada persis di posisi awal Track A.
          - Tidak ada lompatan pixel, tidak ada jeda, dan tidak ada celah kosong.
          - Hover pada container akan pause animasi secara halus.
        */}
        <div
          className="tfn-ticker flex items-center hover:[animation-play-state:paused]"
          style={{ animationDuration: `${animDurationSeconds}s` }}
        >
          {/* Paruh 1 (Track A) */}
          <ul className="flex shrink-0 items-center gap-6 pr-6">
            {displayTiles.map((s, idx) => (
              <SponsorTile key={`a-${s.id}-${idx}`} sponsor={s} lang={lang} />
            ))}
          </ul>

          {/* Paruh 2 (Track B - aria-hidden untuk screen reader) */}
          <ul aria-hidden="true" className="flex shrink-0 items-center gap-6 pr-6">
            {displayTiles.map((s, idx) => (
              <SponsorTile key={`b-${s.id}-${idx}`} sponsor={s} lang={lang} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
