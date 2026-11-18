import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ChevronRight } from "lucide-react";

export const revalidate = 60;

export default async function PublicFightsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; division?: string }>;
}) {
  const { division } = await searchParams;

  const fights = await prisma.fight.findMany({
    where: {
      status: "COMPLETED",
      result: { status: "OFFICIAL" },
      weightClass: division ? { slug: division } : undefined,
    },
    include: {
      event: true,
      weightClass: true,
      participants: { include: { fighter: true } },
      result: { include: { method: true, winner: { include: { fighter: true } } } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 30,
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
            RIWAYAT HASIL PERTANDINGAN RESMI TFN
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted mt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">BERANDA</Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">HASIL PERTANDINGAN TFN</span>
          </div>
        </div>
      </div>

      {/* 2. Fights Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="bg-charcoal text-ink overflow-x-auto shadow-2xl border border-subtle">
          <table className="w-full text-left border-collapse font-sans text-xs sm:text-sm">
            <thead>
              <tr className="bg-canvas text-ink font-display text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">TANGGAL / EVENT</th>
                <th className="py-3 px-4 font-bold">DUEL PETARUNG</th>
                <th className="py-3 px-4 font-bold">DIVISI</th>
                <th className="py-3 px-4 text-center bg-fight-red text-ink font-black w-28">
                  HASIL RESMI
                </th>
                <th className="py-3 px-4 font-bold text-center">METODE</th>
                <th className="py-3 px-4 text-right font-bold">RONDE / WAKTU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-sans">
              {fights.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center font-mono-data text-xs text-ink-subtle">
                    Belum ada hasil pertandingan yang diterbitkan untuk pilihan ini.
                  </td>
                </tr>
              ) : (
                fights.map((f, idx) => {
                  const redFighter = f.participants.find((p) => p.corner === "RED")?.fighter;
                  const blueFighter = f.participants.find((p) => p.corner === "BLUE")?.fighter;
                  const winnerFighter = f.result?.winner?.fighter;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={f.id}
                      className={`transition-colors hover:bg-surface-elevated ${isEven ? "bg-charcoal" : "bg-surface"
                        }`}
                    >
                      <td className="py-3.5 px-4 font-mono-data text-xs">
                        <p className="text-ink font-bold">
                          {new Date(f.scheduledAt).toLocaleDateString("id-ID")}
                        </p>
                        <p className="text-ink-subtle text-[10px] mt-0.5">
                          {f.event?.name || "Laga Utama TFN"}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 font-display text-base sm:text-lg text-ink">
                        <span className={winnerFighter?.id === redFighter?.id ? "text-fight-red font-black" : "font-bold"}>
                          {redFighter ? `${redFighter.firstName} ${redFighter.lastName}` : "TBD"}
                        </span>
                        <span className="text-ink-muted text-xs mx-2 font-sans">vs</span>
                        <span className={winnerFighter?.id === blueFighter?.id ? "text-fight-red font-black" : "font-bold"}>
                          {blueFighter ? `${blueFighter.firstName} ${blueFighter.lastName}` : "TBD"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono-data text-xs text-ink-subtle font-medium">
                        {f.weightClass.name}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono-data text-xs font-black text-fight-red bg-fight-red/5">
                        {winnerFighter ? `${winnerFighter.lastName} MENANG` : "DRAW / SERI"}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono-data text-xs text-ink-muted">
                        {f.result?.method?.code || "DECISION"}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono-data text-xs text-ink font-bold">
                        R{f.result?.endRound || 12} ({f.result?.endTime || "3:00"})
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
