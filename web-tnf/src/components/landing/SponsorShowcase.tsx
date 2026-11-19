"use client";

import React from "react";
import { Handshake } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  SPONSOR_TIERS,
  SPONSOR_TIER_ORDER,
  sponsorTierLabel,
  type SponsorTierKey,
} from "@/lib/sponsors/tiers";

export interface SponsorShowcaseItem {
  id: string;
  name: string;
  url: string | null;
  tier: SponsorTierKey;
  logoUrl: string | null;
}

function ShowcasePlate({ sponsor }: { sponsor: SponsorShowcaseItem }) {
  const [imgError, setImgError] = React.useState(false);

  return (
    <span className="flex h-20 w-40 items-center justify-center border border-subtle bg-charcoal px-4 py-3 transition-colors duration-300 group-hover:border-fight-red sm:h-24 sm:w-48 overflow-hidden">
      {sponsor.logoUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sponsor.logoUrl}
          alt={`Logo ${sponsor.name}`}
          loading="lazy"
          onError={() => setImgError(true)}
          className="max-h-12 max-w-full object-contain opacity-85 grayscale contrast-125 transition duration-300 group-hover:opacity-100 group-hover:grayscale-0"
        />
      ) : (
        <span className="text-center font-display text-xs font-black uppercase leading-tight tracking-wider text-ink group-hover:text-fight-red transition-colors px-1 truncate">
          {sponsor.name}
        </span>
      )}
    </span>
  );
}

/**
 * Blok sponsor di beranda. Dirender HANYA kalau ada sponsor aktif di database —
 * tidak ada placeholder atau klaim sponsor fiktif saat daftar kosong.
 */
export function SponsorShowcase({ sponsors }: { sponsors: SponsorShowcaseItem[] }) {
  const { lang } = useLanguage();
  const isEn = lang === "en";

  if (!sponsors || sponsors.length === 0) return null;

  const grouped = SPONSOR_TIERS.filter((tier) => sponsors.some((s) => s.tier === tier.key)).sort(
    (a, b) => SPONSOR_TIER_ORDER[a.key] - SPONSOR_TIER_ORDER[b.key]
  );

  return (
    <section
      aria-labelledby="sponsor-showcase-heading"
      className="border-y border-subtle bg-canvas py-12 sm:py-16"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col items-center gap-2 text-center sm:mb-10">
          <span className="inline-flex items-center gap-2 border border-gold/40 px-2.5 py-1 font-mono-data text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <Handshake className="h-3 w-3" aria-hidden="true" />
            {isEn ? "Sponsors & partners" : "Sponsor & mitra resmi"}
          </span>
          <h2
            id="sponsor-showcase-heading"
            className="font-display text-2xl font-black uppercase text-ink sm:text-3xl"
          >
            {isEn ? "Backed by" : "Didukung oleh"}
          </h2>
        </div>

        <div className="space-y-8">
          {grouped.map((tier) => {
            const items = sponsors.filter((s) => s.tier === tier.key);
            return (
              <div key={tier.key}>
                <p className="mb-3 text-center font-mono-data text-[10px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
                  {sponsorTierLabel(tier.key, isEn ? "en" : "id")}
                </p>
                <ul className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                  {items.map((sponsor) => (
                    <li key={sponsor.id}>
                      {sponsor.url ? (
                        <a
                          href={sponsor.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow sponsored"
                          className="group block"
                          aria-label={`${sponsor.name} — ${isEn ? "opens in a new tab" : "buka di tab baru"}`}
                        >
                          <ShowcasePlate sponsor={sponsor} />
                        </a>
                      ) : (
                        <span className="group block">
                          <ShowcasePlate sponsor={sponsor} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
