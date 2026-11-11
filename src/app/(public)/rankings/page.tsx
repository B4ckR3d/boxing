import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Trophy, ChevronRight } from "lucide-react";

export const revalidate = 60;

export default async function PublicRankingsPage() {
  const publishedVersions = await prisma.rankingVersion.findMany({
    where: { status: "PUBLISHED" },
    include: {
      weightClass: true,
      entries: {
        include: { fighter: true },
        orderBy: [{ isChampion: "desc" }, { rank: "asc" }],
      },
    },
    orderBy: { versionNumber: "desc" },
  });

  return (
    <div className="bg-canvas min-h-screen text-ink select-none transition-colors">
      {/* 1. Dark Arena Top Header Banner (From Reference Image 4) */}
      <div
        className="relative bg-cover bg-center py-20 border-b border-subtle text-center"
        style={{
          backgroundImage: "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="font-display text-4xl sm:text-6xl text-ink uppercase font-black tracking-tight">
            TABEL PERINGKAT RESMI TFN
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted mt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">BERANDA</Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">PERINGKAT KOMISI TFN</span>
          </div>
        </div>
      </div>

      {/* 2. Content Divisions Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {publishedVersions.map((version) => {
          const rawName = version.weightClass?.name?.toUpperCase() || "POUND-FOR-POUND";
          const divisionTitle =
            rawName === "HEAVYWEIGHT"
              ? "KELAS BERAT (HEAVYWEIGHT)"
              : rawName === "WELTERWEIGHT"
              ? "KELAS WELTER (WELTERWEIGHT)"
              : rawName === "MIDDLEWEIGHT"
              ? "KELAS MENENGAH (MIDDLEWEIGHT)"
              : rawName;

          return (
            <div key={version.id} className="space-y-6">
              {/* Centered Division Headline (From Reference Image 4) */}
              <div className="text-center">
                <h2 className="font-display text-3xl sm:text-5xl text-ink uppercase tracking-wider font-black">
                  {divisionTitle}
                </h2>
                <div className="w-16 h-1 bg-fight-red mx-auto mt-2" />
                <p className="font-mono-data text-xs text-ink-muted mt-2">
                  BATAS BOBOT: {version.weightClass ? `${version.weightClass.limitLbs} LBS / ${version.weightClass.limitKg} KG` : "SEMUA DIVISI"} · VERSI {version.versionNumber}.0
                </p>
              </div>

              {/* The Signature Table from Image 4 */}
              <div className="bg-charcoal text-ink overflow-x-auto shadow-2xl border border-subtle">
                <table className="w-full text-left border-collapse font-sans text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-canvas text-ink font-display text-xs uppercase tracking-wider">
                      <th className="py-3 px-4 w-20 text-center font-bold">POSISI</th>
                      <th className="py-3 px-4 font-bold">PETARUNG</th>
                      <th className="py-3 px-4 font-bold">SASANA / KLUB</th>
                      <th className="py-3 px-4 text-center font-bold">NEGARA</th>
                      {/* Red WINS Column */}
                      <th className="py-3 px-4 text-center bg-fight-red text-ink font-black w-20">
                        MENANG
                      </th>
                      <th className="py-3 px-4 text-center font-bold w-20">KALAH</th>
                      <th className="py-3 px-4 text-center font-bold w-20">SERI</th>
                      <th className="py-3 px-4 text-center font-bold w-24">POIN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-sans">
                    {version.entries.map((entry, idx) => {
                      const isChamp = entry.isChampion;
                      const isEven = idx % 2 === 0;

                      return (
                        <tr
                          key={entry.id}
                          className={`transition-colors hover:bg-surface-elevated ${
                            isChamp
                              ? "bg-amber-50/70 font-semibold"
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
                              <span>{entry.rank ?? idx + 1}</span>
                            )}
                          </td>

                          {/* Fighter */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/fighters/${entry.fighter.slug}`}
                                className="font-display text-base sm:text-lg font-bold text-ink hover:text-fight-red transition-colors uppercase"
                              >
                                {entry.fighter.firstName} {entry.fighter.lastName}
                              </Link>
                              {isChamp && (
                                <span className="bg-fight-red text-ink font-mono-data text-[9px] font-black px-1.5 py-0.5 uppercase">
                                  JUARA BERTAHAN
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Club */}
                          <td className="py-3.5 px-4 text-ink-subtle font-medium">
                            TEMANGGUNG COMBAT CLUB
                          </td>

                          {/* Nationality */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono-data text-xs font-bold bg-surface-elevated text-ink px-2 py-0.5">
                              {entry.fighter.nationality}
                            </span>
                          </td>

                          {/* WINS (Bolded) */}
                          <td className="py-3.5 px-4 text-center font-mono-data text-sm font-black text-ink bg-fight-red/5">
                            {entry.fighter.wins}
                          </td>

                          {/* DEFEAT */}
                          <td className="py-3.5 px-4 text-center font-mono-data text-sm text-ink-subtle">
                            {entry.fighter.losses}
                          </td>

                          {/* DRAWS */}
                          <td className="py-3.5 px-4 text-center font-mono-data text-sm text-ink-subtle">
                            {entry.fighter.draws}
                          </td>

                          {/* POINTS */}
                          <td className="py-3.5 px-4 text-center font-mono-data text-sm font-bold text-ink">
                            {entry.points ? Number(entry.points).toFixed(1) : "25.0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Footer Note */}
                <div className="p-3 bg-neutral-50 border-t border-subtle text-ink-subtle font-mono-data text-[10px]">
                  * - PETARUNG YANG BERTANDING DALAM 10 EVENT RESMI TFN TERAKHIR
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
