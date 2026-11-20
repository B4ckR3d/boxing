"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { sponsorTierLabel, type SponsorTierKey } from "@tfn/core/sponsor-tiers";
import type { PublicSponsor } from "@/server/services/sponsor.service";

/**
 * Sponsor section di bawah halaman beranda (tepat di atas footer).
 *
 * Menerima data sponsor aktif dari DB via `getPublicSponsors()`.
 * Jika kosong, fallback ke daftar placeholder resmi.
 *
 * HIERARKI VISUAL (sesuai kesepakatan tier):
 * 1. PLATINUM — kartu PALING BESAR, STATIS (tidak berjalan). Grid 1–3 kolom.
 * 2. GOLD     — di bawah platinum, lebih kecil, marquee BERJALAN ke kiri.
 * 3. SILVER   — di bawah gold, lebih kecil lagi, marquee BERJALAN ke kanan
 *               (berlawanan arah dengan gold).
 * 4. PARTNER / MEDIA PARTNER — baris statis kompak di paling bawah.
 *
 * Marquee tetap true-infinite-loop: setiap lintasan punya dua paruh identik
 * (translateX ±50%), jadi tidak pernah ada celah kosong di resolusi apa pun.
 * Hover / focus di dalam seksi menjeda animasi supaya logo bisa dibaca.
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
  { id: "ph-pemkab", name: "Pemkab Temanggung", tier: "PLATINUM", logoUrl: "/images/partners/pemkab-temanggung.png", url: "https://temanggungkab.go.id" },
  { id: "ph-kickboxing", name: "Kickboxing Temanggung", tier: "GOLD", logoUrl: "/images/partners/kickboxing-temanggung.png", url: null },
  { id: "ph-perbati", name: "PERBATI Temanggung", tier: "GOLD", logoUrl: "/images/partners/perbati-temanggung.png", url: null },
  { id: "ph-bri", name: "Bank BRI", tier: "GOLD", logoUrl: null, url: "https://bri.co.id" },
  { id: "ph-telkom", name: "Telkom Indonesia", tier: "SILVER", logoUrl: null, url: "https://telkom.co.id" },
  { id: "ph-tbc", name: "Temanggung Boxing Camp", tier: "PARTNER", logoUrl: null, url: null },
  { id: "ph-gor", name: "GOR Bambu Runcing", tier: "PARTNER", logoUrl: null, url: null },
  { id: "ph-suara", name: "Suara Temanggung", tier: "MEDIA_PARTNER", logoUrl: null, url: null },
  { id: "ph-megaswara", name: "Radio Megaswara FM", tier: "MEDIA_PARTNER", logoUrl: null, url: null },
];

// ── Tile component ────────────────────────────────────────────────────────────

interface TileData {
  id: string;
  name: string;
  tier: SponsorTierKey;
  logoUrl: string | null;
  url: string | null;
}

type TileSize = "platinum" | "gold" | "silver" | "compact";

interface SizeStyle {
  card: string;
  label: string;
  logoBox: string;
  logo: string;
  name: string;
  accent: string;
  gap: string;
}

const SIZE_STYLES: Record<TileSize, SizeStyle> = {
  // PLATINUM — panggung utama, tetap paling besar tapi ramping (bukan papan billboard).
  platinum: {
    card: "h-28 px-4 py-3 sm:h-32 sm:px-6 lg:h-36",
    label: "text-[10px] sm:text-[11px] tracking-[0.22em]",
    logoBox: "h-16 sm:h-20",
    logo: "max-h-16 sm:max-h-20",
    name: "text-base sm:text-lg lg:text-xl",
    accent: "w-8 sm:w-10",
    gap: "gap-3 sm:gap-4",
  },
  // GOLD — marquee, satu tingkat di bawah platinum.
  gold: {
    card: "h-16 w-36 px-3 py-2 sm:h-20 sm:w-44 md:w-48",
    label: "text-[9px] sm:text-[10px] tracking-[0.18em]",
    logoBox: "h-8 sm:h-10",
    logo: "max-h-7 sm:max-h-9 max-w-[90px] sm:max-w-[120px]",
    name: "text-xs sm:text-sm",
    accent: "w-6 sm:w-7",
    gap: "gap-2.5 sm:gap-3",
  },
  // SILVER — marquee arah berlawanan, kartu paling kecil.
  silver: {
    card: "h-14 w-32 px-2.5 py-1.5 sm:h-16 sm:w-36 md:w-40",
    label: "text-[8px] sm:text-[9px] tracking-[0.16em]",
    logoBox: "h-7 sm:h-8",
    logo: "max-h-6 sm:max-h-7 max-w-[70px] sm:max-w-[90px]",
    name: "text-[11px] sm:text-xs",
    accent: "w-5 sm:w-6",
    gap: "gap-2 sm:gap-2.5",
  },
  // PARTNER / MEDIA — grid statis kompak.
  compact: {
    card: "h-14 w-full px-3 py-1.5 sm:h-16",
    label: "text-[9px] sm:text-[10px] tracking-[0.18em]",
    logoBox: "h-8 sm:h-9",
    logo: "max-h-7 sm:max-h-8 max-w-[100px] sm:max-w-[120px]",
    name: "text-[11px] sm:text-xs",
    accent: "w-5 sm:w-6",
    gap: "gap-2.5 sm:gap-3",
  },
};

function SponsorTile({
  sponsor,
  lang,
  size = "compact",
}: {
  sponsor: TileData;
  lang: "id" | "en";
  size?: TileSize;
}) {
  const tierLabel = sponsorTierLabel(sponsor.tier, lang);
  const s = SIZE_STYLES[size];
  const [imgError, setImgError] = React.useState(false);

  const inner = (
    <div
      className={`group/tile relative flex flex-col items-center justify-between border border-subtle bg-charcoal transition-all duration-300 hover:border-fight-red hover:bg-surface hover:shadow-xl hover:shadow-fight-red/10 ${s.card}`}
    >
      {/* Tier label di pojok atas */}
      <div className="flex w-full items-center justify-between">

        {sponsor.url && (
          <ArrowUpRight
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-ink-subtle opacity-0 transition-all duration-200 group-hover/tile:text-fight-red group-hover/tile:opacity-100"
          />
        )}
      </div>

      {/* Area Logo / Typographic Wordmark */}
      <div
        className={`relative flex w-full items-center justify-center overflow-hidden px-2 ${s.logoBox}`}
      >
        {sponsor.logoUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            onError={() => setImgError(true)}
            className={`w-auto object-contain opacity-85 grayscale contrast-125 transition-all duration-300 group-hover/tile:scale-105 group-hover/tile:grayscale-0 group-hover/tile:opacity-100 ${s.logo}`}
          />
        ) : (
          <span
            className={`line-clamp-2 max-w-full px-2 text-center font-display font-black uppercase tracking-wider text-ink transition-colors group-hover/tile:text-fight-red ${s.name}`}
          >
            {sponsor.name}
          </span>
        )}
      </div>

      {/* Garis aksen minimal di bawah */}
      <div
        className={`h-0.5 bg-subtle transition-all duration-300 group-hover/tile:w-14 group-hover/tile:bg-fight-red ${s.accent}`}
      />
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
          className="block focus-visible:ring-2 focus-visible:ring-fight-red focus-visible:outline-none"
        >
          {inner}
        </a>
      ) : (
        inner
      )}
    </li>
  );
}

// ── Marquee strip ─────────────────────────────────────────────────────────────

/**
 * Satu lintasan marquee. `reverse` membalik arah (kanan → kiri vs kiri → kanan)
 * tanpa mengubah mekanika seamless loop: paruh kedua tetap kembar identik,
 * hanya keyframes yang bergerak dari -50% ke 0.
 */
function MarqueeStrip({
  tiles,
  lang,
  size,
  reverse = false,
  minCount,
  secondsPerTile = 2.6,
  minSeconds = 40,
}: {
  tiles: TileData[];
  lang: "id" | "en";
  size: TileSize;
  reverse?: boolean;
  minCount: number;
  secondsPerTile?: number;
  minSeconds?: number;
}) {
  if (tiles.length === 0) return null;

  // Ulangi data sampai satu paruh cukup lebar (anti black-gap di layar ultrawide).
  const repeatCount = Math.max(1, Math.ceil(minCount / Math.max(1, tiles.length)));
  const displayTiles = Array.from({ length: repeatCount }, () => tiles).flat();
  const duration = Math.max(minSeconds, Math.round(displayTiles.length * secondsPerTile));

  return (
    <div className="relative mt-3 overflow-hidden select-none sm:mt-4">
      {/* Edge gradient fades */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-canvas-deep to-transparent sm:w-28"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-canvas-deep to-transparent sm:w-28"
      />

      <div
        className={`tfn-ticker items-center hover:[animation-play-state:paused] ${reverse ? "tfn-ticker-reverse" : ""}`}
        style={{ animationDuration: `${duration}s` }}
      >
        {/* Paruh 1 */}
        <ul className={`flex shrink-0 items-center pr-4 sm:pr-5 ${SIZE_STYLES[size].gap}`}>
          {displayTiles.map((sponsor, idx) => (
            <SponsorTile key={`a-${size}-${sponsor.id}-${idx}`} sponsor={sponsor} lang={lang} size={size} />
          ))}
        </ul>
        {/* Paruh 2 (aria-hidden — dekoratif) */}
        <ul aria-hidden="true" className={`flex shrink-0 items-center pr-4 sm:pr-5 ${SIZE_STYLES[size].gap}`}>
          {displayTiles.map((sponsor, idx) => (
            <SponsorTile key={`b-${size}-${sponsor.id}-${idx}`} sponsor={sponsor} lang={lang} size={size} />
          ))}
        </ul>
      </div>
    </div>
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
  const allTiles: TileData[] =
    sponsors.length > 0 ? sponsors.map((s) => ({ ...s })) : PLACEHOLDER_SPONSORS;

  const byTier = (tier: SponsorTierKey) => allTiles.filter((s) => s.tier === tier);

  const platinum = byTier("PLATINUM");
  const gold = byTier("GOLD");
  const silver = byTier("SILVER");
  const supporting = [...byTier("PARTNER"), ...byTier("MEDIA_PARTNER")];

  // WhatsApp TFN Admin (Kontak 2 resmi: +62 858-4800-0639)
  const waMessage =
    lang === "id"
      ? encodeURIComponent("Halo Admin TFN, saya tertarik untuk menjadi partner / sponsor Temanggung Fight Night.")
      : encodeURIComponent("Hello TFN Admin, I am interested in becoming a partner / sponsor for Temanggung Fight Night.");
  const waUrl = `https://wa.me/6285848000639?text=${waMessage}`;

  return (
    <section
      aria-labelledby="sponsor-marquee-title"
      className="tfn-sponsor-marquee group relative border-y border-subtle bg-canvas-deep py-12 transition-colors sm:py-16"
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

      {/* 1. PLATINUM — statis, kartu paling besar */}
      {platinum.length > 0 && (
        <div className="mx-auto mt-6 max-w-7xl px-4 sm:mt-8 sm:px-6 lg:px-8">
          <ul
            className={`grid grid-cols-1 ${SIZE_STYLES.platinum.gap} ${platinum.length >= 3
              ? "sm:grid-cols-2 lg:grid-cols-3"
              : platinum.length === 2
                ? "sm:grid-cols-2"
                : "mx-auto max-w-lg"
              }`}
          >
            {platinum.map((sponsor) => (
              <SponsorTile key={`platinum-${sponsor.id}`} sponsor={sponsor} lang={lang} size="platinum" />
            ))}
          </ul>
        </div>
      )}

      {/* 2. GOLD — marquee ke kiri */}
      <MarqueeStrip tiles={gold} lang={lang} size="gold" minCount={18} secondsPerTile={2.6} minSeconds={45} />

      {/* 3. SILVER — marquee ke kanan, kartu lebih kecil */}
      <MarqueeStrip
        tiles={silver}
        lang={lang}
        size="silver"
        reverse
        minCount={24}
        secondsPerTile={2.4}
        minSeconds={52}
      />

      {/* 4. PARTNER & MEDIA PARTNER — grid statis kompak */}
      {supporting.length > 0 && (
        <div className="mx-auto mt-5 max-w-7xl px-4 sm:mt-6 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {supporting.map((sponsor) => (
              <SponsorTile key={`supporting-${sponsor.id}`} sponsor={sponsor} lang={lang} size="compact" />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
