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
  fighterASeed?: number;
  fighterBSeed?: number;
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

  const bout1 = tournament.bouts[0];
  const bout2 = tournament.bouts[1];

  const b1FighterA = bout1?.fighterAName?.trim() || "COMING SOON";
  const b1FighterB = bout1?.fighterBName?.trim() || "COMING SOON";
  const b2FighterA = bout2?.fighterAName?.trim() || "COMING SOON";
  const b2FighterB = bout2?.fighterBName?.trim() || "COMING SOON";

  const isB1ACS = b1FighterA.toUpperCase().includes("COMING") || b1FighterA === "TBD";
  const isB1BCS = b1FighterB.toUpperCase().includes("COMING") || b1FighterB === "TBD";
  const isB2ACS = b2FighterA.toUpperCase().includes("COMING") || b2FighterA === "TBD";
  const isB2BCS = b2FighterB.toUpperCase().includes("COMING") || b2FighterB === "TBD";

  const isAllCS = isB1ACS && isB1BCS && isB2ACS && isB2BCS;

  return (
    <section className="py-16 bg-canvas border-b border-subtle text-ink select-none transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-subtle pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                OFFICIAL TOURNAMENT
              </span>
              {isAllCS && (
                <span className="border border-fight-red text-fight-red font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                  COMING SOON
                </span>
              )}
            </div>
            <h2 className="font-display text-4xl sm:text-6xl text-ink uppercase tracking-tight font-black">
              {lang === "id" ? "TFN WORLD GRAND PRIX TOURNAMENT" : tournament.name}
            </h2>
          </div>

          <Button asChild variant="outline" size="sm" className="font-bold flex items-center gap-1.5">
            <Link href="/grand-prix">
              <span>{t("gpBtnExplore")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
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
                  <span className={isB1ACS ? "text-ink font-black tracking-wide" : "font-extrabold"}>
                    {b1FighterA}
                  </span>
                  <span className={`text-[10px] font-mono-data font-bold px-1.5 py-0.5 ${isB1ACS ? "bg-surface-elevated text-ink-muted border border-subtle" : "bg-fight-red text-ink"}`}>
                    {isB1ACS ? "TBA" : `#${bout1?.fighterASeed ?? 1} SEED`}
                  </span>
                </div>
                <div className="border-t border-subtle flex items-center justify-center my-1">
                  <span className="bg-charcoal px-2 font-mono-data text-[10px] text-fight-red font-bold">
                    VS
                  </span>
                </div>
                <div className="flex items-center justify-between font-display text-lg text-ink-muted">
                  <span className={isB1BCS ? "text-ink-muted font-black tracking-wide" : "font-extrabold"}>
                    {b1FighterB}
                  </span>
                  <span className="text-[10px] font-mono-data border border-subtle text-ink-muted px-1.5 py-0.5">
                    {isB1BCS ? "TBA" : `#${bout1?.fighterBSeed ?? 4} SEED`}
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
              <p className="font-display text-2xl sm:text-3xl text-ink font-black uppercase">
                {tournament.titleAwarded || t("gpTrophy") || "PIALA KEJUARAAN TFN"}
              </p>
              <p className="font-mono-data text-[10px] text-fight-red font-bold uppercase">
                {isAllCS ? "COMING SOON · MUSIM BARU SEGERA DIMULAI" : (tournament.prize || "24 DESEMBER 2026 · LIVE STREAMING PPV")}
              </p>
            </div>

            {/* Semi-Final Bout 02 */}
            <div className="space-y-3">
              <span className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider block border-b border-subtle pb-1">
                {t("gpSemi2")}
              </span>
              <div className="bg-canvas border border-subtle p-4 space-y-2">
                <div className="flex items-center justify-between font-display text-lg text-ink">
                  <span className={isB2ACS ? "text-ink font-black tracking-wide" : "font-extrabold"}>
                    {b2FighterA}
                  </span>
                  <span className={`text-[10px] font-mono-data font-bold px-1.5 py-0.5 ${isB2ACS ? "bg-surface-elevated text-ink-muted border border-subtle" : "bg-fight-red text-ink"}`}>
                    {isB2ACS ? "TBA" : `#${bout2?.fighterASeed ?? 2} SEED`}
                  </span>
                </div>
                <div className="border-t border-subtle flex items-center justify-center my-1">
                  <span className="bg-charcoal px-2 font-mono-data text-[10px] text-fight-red font-bold">
                    VS
                  </span>
                </div>
                <div className="flex items-center justify-between font-display text-lg text-ink-muted">
                  <span className={isB2BCS ? "text-ink-muted font-black tracking-wide" : "font-extrabold"}>
                    {b2FighterB}
                  </span>
                  <span className="text-[10px] font-mono-data border border-subtle text-ink-muted px-1.5 py-0.5">
                    {isB2BCS ? "TBA" : `#${bout2?.fighterBSeed ?? 3} SEED`}
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
