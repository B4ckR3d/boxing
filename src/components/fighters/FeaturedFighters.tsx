"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface FeaturedFighterData {
  id: string;
  slug: string;
  fullName: string;
  ringName?: string | null;
  division: string;
  record: string;
  koWins: number;
  totalWins: number;
  stance: string;
  nationality: string;
  isChampion: boolean;
  imageUrl?: string | null;
}

export function FeaturedFighters({ fighters }: { fighters: FeaturedFighterData[] }) {
  const { t } = useLanguage();

  return (
    <section className="py-20 bg-canvas border-b border-subtle text-ink transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto">
          <h2 className="font-display text-4xl sm:text-6xl text-ink uppercase tracking-tight font-black">
            {t("rosterTitleMain")} <span className="text-fight-red">{t("rosterTitleHighlight")}</span>
          </h2>
        </div>

        {/* 4-Column Fighter Grid (From Reference Image 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {fighters.slice(0, 4).map((f) => (
            <div
              key={f.id}
              className="bg-charcoal border border-subtle group hover:border-fight-red transition-all flex flex-col justify-between overflow-hidden shadow-lg"
            >
              {/* Fighter Photo */}
              <div className="w-full h-80 relative bg-canvas overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.imageUrl || "/images/fighters/marcus-vale.jpg"}
                  alt={f.fullName}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />

                {/* Champion Pill */}
                {f.isChampion && (
                  <div className="absolute top-3 left-3 bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-md">
                    CHAMPION
                  </div>
                )}

                {/* Country Tag */}
                <div className="absolute top-3 right-3 bg-canvas/80 border border-subtle text-ink font-mono-data text-[10px] font-bold uppercase px-2 py-0.5">
                  {f.nationality}
                </div>
              </div>

              {/* Bottom Info Bar with Name & Social Icons (Image 1 style) */}
              <div className="p-5 bg-charcoal text-center border-t border-subtle space-y-3">
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-wider text-ink group-hover:text-fight-red transition-colors">
                    {f.fullName}
                  </h3>
                  <p className="font-mono-data text-[11px] text-ink-muted mt-0.5 uppercase tracking-wide">
                    {f.division} · {f.record}
                  </p>
                </div>

                {/* Social Media Round Icons Row (From Reference Image 1) */}
                <div className="flex items-center justify-center gap-2 pt-1 text-ink-muted">
                  <span className="w-6 h-6 rounded-full bg-surface-elevated hover:bg-fight-red hover:text-ink flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                    f
                  </span>
                  <span className="w-6 h-6 rounded-full bg-surface-elevated hover:bg-fight-red hover:text-ink flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                    ✆
                  </span>
                  <span className="w-6 h-6 rounded-full bg-surface-elevated hover:bg-fight-red hover:text-ink flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                    𝕏
                  </span>
                  <span className="w-6 h-6 rounded-full bg-surface-elevated hover:bg-fight-red hover:text-ink flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                    o
                  </span>
                </div>

                <div className="pt-2 border-t border-subtle/80">
                  <Link
                    href={`/fighters/${f.slug}`}
                    className="inline-flex items-center gap-1 font-mono-data text-xs font-bold text-fight-red hover:underline"
                  >
                    <span>{t("viewProfile")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center pt-4">
          <Link href="/fighters">
            <Button variant="outline" size="md" className="font-bold tracking-wider px-8">
              {t("rosterBtnMore")} →
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
