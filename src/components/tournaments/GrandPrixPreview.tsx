"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface TournamentBoutPreview {
  round: number;
  position: number;
  fighterAName: string;
  fighterBName: string;
  winnerName?: string;
  status: string;
}

export interface GrandPrixPreviewProps {
  tournament: {
    id: string;
    slug: string;
    name: string;
    division: string;
    prize?: string | null;
    titleAwarded?: string | null;
    size: number;
    status: string;
    bouts: TournamentBoutPreview[];
  };
}

export function GrandPrixPreview({ tournament }: GrandPrixPreviewProps) {
  const { t, lang } = useLanguage();

  return (
    <section className="py-16 bg-canvas border-b border-subtle text-ink select-none transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-subtle pb-6">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl text-ink uppercase tracking-tight font-black">
              {lang === "id" ? "TFN WORLD GRAND PRIX TOURNAMENT" : tournament.name}
            </h2>
          </div>

          <Link href="/grand-prix">
            <Button variant="outline" size="sm" className="font-bold flex items-center gap-1.5">
              <span>{t("gpBtnExplore")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Interactive Bracket Graphic Card */}
        <div className="bg-charcoal border border-subtle p-6 sm:p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Semi-Final Bout 01 */}
            <div className="space-y-3">
              <span className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider block border-b border-subtle pb-1">
                {t("gpSemi1")}
              </span>
              <div className="bg-canvas border border-subtle p-4 space-y-2">
                <div className="flex items-center justify-between font-display text-lg text-ink">
                  <span>Dario Storm</span>
                  <span className="text-[10px] font-mono-data bg-fight-red text-ink font-bold px-1.5 py-0.5">
                    #1 SEED
                  </span>
                </div>
                <div className="border-t border-subtle flex items-center justify-center my-1">
                  <span className="bg-charcoal px-2 font-mono-data text-[10px] text-fight-red font-bold">
                    VS
                  </span>
                </div>
                <div className="flex items-center justify-between font-display text-lg text-ink-muted">
                  <span>Aleksandr Volkov</span>
                  <span className="text-[10px] font-mono-data border border-subtle text-ink-muted px-1.5 py-0.5">
                    #4 SEED
                  </span>
                </div>
              </div>
            </div>

            {/* Championship Finals Target */}
            <div className="text-center p-6 bg-canvas border-2 border-fight-red shadow-fight-red my-auto space-y-2">
              <Trophy className="w-10 h-10 text-fight-red mx-auto" />
              <p className="font-mono-data text-[10px] text-ink-muted font-bold uppercase tracking-widest">
                {t("gpFinalTitle")}
              </p>
              <p className="font-display text-2xl sm:text-3xl text-ink font-black">
                {t("gpTrophy")}
              </p>
              <p className="font-mono-data text-[10px] text-ink-muted">
                24 DESEMBER 2026 · {t("gpLivePpv")}
              </p>
            </div>

            {/* Semi-Final Bout 02 */}
            <div className="space-y-3">
              <span className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider block border-b border-subtle pb-1">
                {t("gpSemi2")}
              </span>
              <div className="bg-canvas border border-subtle p-4 space-y-2">
                <div className="flex items-center justify-between font-display text-lg text-ink">
                  <span>Kenji Arata</span>
                  <span className="text-[10px] font-mono-data bg-fight-red text-ink font-bold px-1.5 py-0.5">
                    #2 SEED
                  </span>
                </div>
                <div className="border-t border-subtle flex items-center justify-center my-1">
                  <span className="bg-charcoal px-2 font-mono-data text-[10px] text-fight-red font-bold">
                    VS
                  </span>
                </div>
                <div className="flex items-center justify-between font-display text-lg text-ink-muted">
                  <span>Jean-Pierre Dubois</span>
                  <span className="text-[10px] font-mono-data border border-subtle text-ink-muted px-1.5 py-0.5">
                    #3 SEED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
