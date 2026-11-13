import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ChevronRight } from "lucide-react";

export const revalidate = 60;

export default async function PublicGrandPrixPage() {
  const tournaments = await prisma.tournament.findMany({
    where: { isPublished: true },
    include: {
      weightClass: true,
      winner: true,
      participants: {
        include: { fighter: true },
        orderBy: { seed: "asc" },
      },
      brackets: {
        include: {
          bouts: {
            include: {
              participantA: { include: { fighter: true } },
              participantB: { include: { fighter: true } },
              winner: { include: { fighter: true } },
            },
            orderBy: [{ round: "asc" }, { position: "asc" }],
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="bg-canvas min-h-screen text-ink select-none transition-colors">
      {/* 1. Header Banner */}
      <div
        className="relative bg-cover bg-center py-20 border-b border-subtle text-center"
        style={{
          backgroundImage: "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="font-display text-4xl sm:text-6xl text-ink uppercase font-black tracking-tight">
            TURNAMEN TFN GRAND PRIX
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted mt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">BERANDA</Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">BRACKET TURNAMEN TFN</span>
          </div>
        </div>
      </div>

      {/* 2. Tournaments Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {tournaments.length === 0 && <p className="border border-subtle bg-charcoal p-8 text-sm leading-7 text-ink-muted">Belum ada turnamen yang diterbitkan. Bagan dan peserta akan ditampilkan setelah tersedia.</p>}
        {tournaments.map((t) => {
          const mainBracket = t.brackets[0];
          const bouts = mainBracket?.bouts || [];

          return (
            <div
              key={t.id}
              className="bg-charcoal border border-subtle p-6 sm:p-10 shadow-xl space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-subtle pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                      {t.weightClass.name}
                    </span>
                    <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                      {t.status === "IN_PROGRESS" ? "SEDANG BERLANGSUNG" : t.status}
                    </span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-5xl text-ink uppercase font-black">
                    TFN {t.name}
                  </h2>
                  {t.prize && (
                    <p className="font-mono-data text-xs text-fight-red font-bold mt-1">
                      TOTAL HADIAH (PURSE): {t.prize}
                    </p>
                  )}
                </div>

                <div className="text-right font-mono-data text-xs text-ink-muted">
                  <p>FORMAT: {t.size}-MAN SISTEM GUGUR TUNGGAL</p>
                  <p className="text-ink font-bold mt-0.5">DATA TURNAMEN TERBITAN TFN</p>
                </div>
              </div>

              {/* Tournament Interactive Bracket Display */}
              <div className="space-y-6">
                <p className="font-mono-data text-xs font-bold text-ink-muted uppercase tracking-wider">
                  BAGAN BRACKET & PROGRES PERTANDINGAN
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {bouts.map((bout, idx) => (
                    <div
                      key={bout.id || idx}
                      className="bg-canvas border border-subtle p-4 shadow-md space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-subtle pb-2 font-mono-data text-[11px] text-ink-muted">
                        <span>RONDE {bout.round} · LAGA {bout.position}</span>
                        <span className="text-fight-red font-bold">{bout.status}</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-display text-lg text-ink">
                          <span>
                            {bout.participantA?.fighter
                              ? `${bout.participantA.fighter.firstName} ${bout.participantA.fighter.lastName}`
                              : "TBD"}
                          </span>
                        </div>

                        <div className="border-t border-subtle flex items-center justify-center my-1">
                          <span className="bg-charcoal px-2 font-mono-data text-[10px] text-fight-red font-bold">
                            VS
                          </span>
                        </div>

                        <div className="flex items-center justify-between font-display text-lg text-ink-muted">
                          <span>
                            {bout.participantB?.fighter
                              ? `${bout.participantB.fighter.firstName} ${bout.participantB.fighter.lastName}`
                              : "TBD"}
                          </span>
                        </div>
                      </div>

                      {bout.winner?.fighter && (
                        <div className="pt-2 border-t border-subtle font-mono-data text-xs text-fight-red font-bold">
                          PEMENANG: {bout.winner.fighter.firstName} {bout.winner.fighter.lastName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
