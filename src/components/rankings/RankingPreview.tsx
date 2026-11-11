"use client";

import React from "react";
import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface RankingEntryPreview {
  fighterId: string;
  fighterName: string;
  fighterSlug: string;
  record: string;
  rank: number | null;
  isChampion: boolean;
  points: number | null;
  movement: number | null;
  isNew: boolean;
  weightClassName: string;
  nationality: string;
}

export interface RankingPreviewProps {
  divisionName: string;
  versionNumber: number;
  effectiveDate: string;
  entries: RankingEntryPreview[];
}

export function RankingPreview({
  divisionName,
  versionNumber,
  effectiveDate,
  entries,
}: RankingPreviewProps) {
  const { t, lang } = useLanguage();

  const divisionDisplay =
    lang === "id"
      ? divisionName.toUpperCase() === "HEAVYWEIGHT"
        ? "KELAS BERAT (HEAVYWEIGHT)"
        : divisionName.toUpperCase()
      : divisionName.toUpperCase();

  return (
    <section className="py-16 bg-canvas border-b border-subtle text-ink select-none transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header (From Reference Image 4) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-subtle pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                {t("rankingsEyebrow")}
              </span>
              <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                {t("rankingsVersion")} {versionNumber}.0
              </span>
            </div>
            <h2 className="font-display text-4xl sm:text-6xl text-ink uppercase tracking-tight font-black">
              {divisionDisplay} <span className="text-fight-red">{t("rankingsTitleSuffix")}</span>
            </h2>
            <p className="font-mono-data text-xs text-ink-muted mt-1">
              {t("rankingsEffective")}: {effectiveDate} · {t("rankingsRatifiedBy")}
            </p>
          </div>

          <Link href="/rankings">
            <Button variant="outline" size="sm" className="font-bold flex items-center gap-1.5">
              <span>{t("rankingsBtnAll")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Division Title (Image 4 centered header) */}
        <div className="text-center pt-2">
          <h3 className="font-display text-3xl sm:text-4xl text-ink uppercase tracking-wider font-black">
            {divisionDisplay}
          </h3>
          <div className="w-12 h-1 bg-fight-red mx-auto mt-2" />
        </div>

        {/* The Signature FNT Ranking Table (Image 4 layout: Black Header + RED WINS Block) */}
        <div className="bg-charcoal text-ink overflow-x-auto shadow-xl border border-subtle">
          <table className="w-full text-left border-collapse font-sans text-xs sm:text-sm">
            {/* Header row: Black background, WINS column has RED background */}
            <thead>
              <tr className="bg-canvas text-ink font-display text-xs uppercase tracking-wider">
                <th className="py-3 px-4 w-20 text-center font-bold">{t("colPosition")}</th>
                <th className="py-3 px-4 font-bold">{t("colFighter")}</th>
                <th className="py-3 px-4 font-bold">{t("colClub")}</th>
                <th className="py-3 px-4 text-center font-bold">{t("colNat")}</th>
                <th className="py-3 px-4 text-center bg-fight-red text-ink font-black w-20">
                  {t("colWins")}
                </th>
                <th className="py-3 px-4 text-center font-bold w-20">{t("colDefeat")}</th>
                <th className="py-3 px-4 text-center font-bold w-20">{t("colDraws")}</th>
                <th className="py-3 px-4 text-center font-bold w-24">{t("colPoints")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-sans">
              {entries.map((e, idx) => {
                const isChamp = e.isChampion;
                const isEven = idx % 2 === 0;

                const parts = (e.record || "0-0-0").split("-");
                const wins = parts[0] || "0";
                const losses = parts[1] || "0";
                const draws = parts[2] || "0";

                return (
                  <tr
                    key={e.fighterId || idx}
                    className={`transition-colors hover:bg-surface-elevated ${
                      isChamp
                        ? "bg-amber-50/80 font-semibold"
                        : isEven
                        ? "bg-charcoal"
                        : "bg-surface"
                    }`}
                  >
                    {/* Position */}
                    <td className="py-3.5 px-4 text-center font-display text-lg font-bold text-ink">
                      {isChamp ? (
                        <span className="inline-flex items-center justify-center gap-1 text-fight-red font-black">
                          <Trophy className="w-4 h-4" /> C
                        </span>
                      ) : (
                        <span>{e.rank ?? idx + 1}</span>
                      )}
                    </td>

                    {/* Fighter Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/fighters/${e.fighterSlug}`}
                          className="font-display text-base sm:text-lg font-bold text-ink hover:text-fight-red transition-colors uppercase"
                        >
                          {e.fighterName}
                        </Link>
                        {isChamp && (
                          <span className="bg-fight-red text-ink font-mono-data text-[9px] font-black px-1.5 py-0.2 uppercase">
                            CHAMPION
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Club / Gym */}
                    <td className="py-3.5 px-4 text-ink-subtle font-medium">
                      TEMANGGUNG BOXING CAMP
                    </td>

                    {/* Nationality */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono-data text-xs font-bold bg-surface-elevated text-ink px-2 py-0.5">
                        {e.nationality}
                      </span>
                    </td>

                    {/* WINS (Highlighted) */}
                    <td className="py-3.5 px-4 text-center font-mono-data text-sm font-black text-ink bg-fight-red/5">
                      {wins}
                    </td>

                    {/* DEFEAT */}
                    <td className="py-3.5 px-4 text-center font-mono-data text-sm text-ink-subtle">
                      {losses}
                    </td>

                    {/* DRAWS */}
                    <td className="py-3.5 px-4 text-center font-mono-data text-sm text-ink-subtle">
                      {draws}
                    </td>

                    {/* POINTS */}
                    <td className="py-3.5 px-4 text-center font-mono-data text-sm font-bold text-ink">
                      {e.points ? Number(e.points).toFixed(1) : "25.0"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Table Footer Note (Image 4 footnote) */}
          <div className="p-3 bg-neutral-50 border-t border-subtle text-ink-subtle font-mono-data text-[10px]">
            {t("rankingFootnote")}
          </div>
        </div>
      </div>
    </section>
  );
}
