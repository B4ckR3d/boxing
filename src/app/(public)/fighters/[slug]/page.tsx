import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Trophy, ChevronRight } from "lucide-react";



export const revalidate = 60;

export default async function FighterProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const fighter = await prisma.fighter.findUnique({
    where: { slug, deletedAt: null },
    include: {
      weightClass: true,
      currentRankings: true,
      beltReigns: {
        include: { belt: true },
        orderBy: { wonAt: "desc" },
      },
      fightParticipants: {
        include: {
          fight: {
            include: {
              event: true,
              weightClass: true,
              result: { include: { method: true, winner: true } },
              participants: { include: { fighter: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!fighter) {
    notFound();
  }

  const isChamp = fighter.currentRankings.some((r) => r.isChampion);
  const koRatio =
    fighter.wins > 0 ? Math.round((fighter.koWins / fighter.wins) * 100) : 0;

  const fighterImages: Record<string, string> = {
    "marcus-iron-vale": "/images/fighters/marcus-vale.jpg",
    "dario-storm": "/images/fighters/dario-storm.jpg",
    "kenji-arata": "/images/fighters/kenji-arata.jpg",
    "tomas-reyes": "/images/fighters/tomas-reyes.jpg",
  };
  const fighterPhoto = fighterImages[fighter.slug] || "/images/fighters/marcus-vale.jpg";

  return (
    <div className="bg-canvas min-h-screen text-foreground select-none transition-colors">
      {/* 1. Header Banner */}
      <div
        className="relative bg-cover bg-center py-16 border-b border-border text-center"
        style={{
          backgroundImage: "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted uppercase tracking-widest mb-3">
            <Link href="/" className="hover:text-ink transition-colors">BERANDA / HOME</Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <Link href="/fighters" className="hover:text-ink transition-colors">PETARUNG / ATHLETES</Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">{fighter.firstName} {fighter.lastName}</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl text-ink uppercase font-black tracking-tight">
            PROFIL & REKOR PETARUNG
          </h1>
        </div>
      </div>

      {/* 2. Main Profile Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="bg-card text-card-foreground border border-border p-6 sm:p-10 shadow-2xl">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Fighter Photo (4 cols) */}
            <div className="lg:col-span-4">
              <div className="w-full h-96 relative bg-surface border-2 border-border overflow-hidden shadow-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fighterPhoto}
                  alt={`${fighter.firstName} ${fighter.lastName}`}
                  className="w-full h-full object-cover object-top"
                />

                {isChamp && (
                  <div className="absolute top-3 left-3 bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-md">
                    JUARA / CHAMPION
                  </div>
                )}
                <div className="absolute top-3 right-3 bg-canvas/80 text-ink font-mono-data text-[10px] font-bold uppercase px-2 py-0.5">
                  {fighter.nationality}
                </div>
              </div>

              {/* Social Icons Row (Image 1 style) */}
              <div className="flex items-center justify-center gap-3 pt-4 text-muted-foreground">
                <span className="w-8 h-8 rounded-full bg-canvas border border-border hover:bg-fight-red hover:text-ink flex items-center justify-center text-xs transition-colors cursor-pointer">
                  f
                </span>
                <span className="w-8 h-8 rounded-full bg-canvas border border-border hover:bg-fight-red hover:text-ink flex items-center justify-center text-xs transition-colors cursor-pointer">
                  ✆
                </span>
                <span className="w-8 h-8 rounded-full bg-canvas border border-border hover:bg-fight-red hover:text-ink flex items-center justify-center text-xs transition-colors cursor-pointer">
                  𝕏
                </span>
                <span className="w-8 h-8 rounded-full bg-canvas border border-border hover:bg-fight-red hover:text-ink flex items-center justify-center text-xs transition-colors cursor-pointer">
                  o
                </span>
              </div>
            </div>

            {/* Fighter Information (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              <div>
                {fighter.ringName && (
                  <p className="font-mono-data text-sm text-fight-red font-bold tracking-widest uppercase">
                    &quot;{fighter.ringName}&quot;
                  </p>
                )}
                <h2 className="font-display text-4xl sm:text-6xl font-black uppercase tracking-tight text-foreground mt-1">
                  {fighter.firstName} {fighter.lastName}
                </h2>
                <p className="font-mono-data text-xs text-muted-foreground mt-1 uppercase">
                  DIVISI {fighter.weightClass.name} · {fighter.hometown || "Temanggung, Jawa Tengah"}
                </p>
              </div>

              {/* Tale of the Tape Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-canvas border border-border p-4">
                  <span className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-wider block">
                    REKOR TARUNG
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-black text-foreground block mt-1">
                    {fighter.wins}W-{fighter.losses}L-{fighter.draws}D
                  </span>
                  <span className="font-mono-data text-[10px] text-fight-red font-bold">
                    {fighter.koWins} KNOCKOUTS
                  </span>
                </div>

                <div className="bg-canvas border border-border p-4">
                  <span className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-wider block">
                    RASIO KO
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-black text-fight-red block mt-1">
                    {koRatio}%
                  </span>
                  <span className="font-mono-data text-[10px] text-muted-foreground">
                    STOPPAGE RATE
                  </span>
                </div>

                <div className="bg-canvas border border-border p-4">
                  <span className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-wider block">
                    GAYA (STANCE)
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-black text-foreground block mt-1">
                    {fighter.stance}
                  </span>
                  <span className="font-mono-data text-[10px] text-muted-foreground">
                    POSTUR TARUNG
                  </span>
                </div>

                <div className="bg-canvas border border-border p-4">
                  <span className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-wider block">
                    TINGGI / JANGKAUAN
                  </span>
                  <span className="font-display text-xl sm:text-2xl font-black text-foreground block mt-1">
                    {fighter.heightCm || 190}CM
                  </span>
                  <span className="font-mono-data text-[10px] text-muted-foreground">
                    REACH: {fighter.reachCm || 200}CM
                  </span>
                </div>
              </div>

              {/* Biography */}
              {fighter.bio && (
                <div className="pt-2">
                  <h3 className="font-display text-base uppercase font-bold text-foreground tracking-wider">
                    BIOGRAFI PETARUNG
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed font-sans">
                    {fighter.bio}
                  </p>
                </div>
              )}

              {/* Championship Belts Held */}
              {fighter.beltReigns.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <h3 className="font-display text-base uppercase font-bold text-fight-red tracking-wider mb-2">
                    SABUK JUARA DUNIA & PENGHARGAAN
                  </h3>
                  <div className="space-y-2">
                    {fighter.beltReigns.map((reign) => (
                      <div
                        key={reign.id}
                        className="bg-canvas border border-border p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <Trophy className="w-4 h-4 text-fight-red" />
                          <span className="font-display text-sm font-bold uppercase text-foreground">
                            {reign.belt.name}
                          </span>
                        </div>
                        <span className="font-mono-data text-[10px] bg-fight-red text-ink font-bold px-2 py-0.5 uppercase">
                          {reign.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Verified Fight Ledger Table (From Image 4 & 5 style) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-display text-2xl font-black uppercase text-foreground tracking-wider">
              RIWAYAT PERTANDINGAN RESMI
            </h3>
            <span className="font-mono-data text-xs text-muted-foreground">
              DISAHKAN OLEH KOMISI PERTANDINGAN TFN
            </span>
          </div>

          <div className="bg-card text-card-foreground overflow-x-auto shadow-2xl border border-border">
            <table className="w-full text-left border-collapse font-sans text-xs sm:text-sm">
              <thead>
                <tr className="bg-surface text-ink font-display text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">TANGGAL / DATE</th>
                  <th className="py-3 px-4 font-bold">LAWAN / OPPONENT</th>
                  <th className="py-3 px-4 font-bold">EVENT</th>
                  <th className="py-3 px-4 text-center bg-fight-red text-ink font-black w-24">
                    HASIL / RESULT
                  </th>
                  <th className="py-3 px-4 text-center font-bold">METODE</th>
                  <th className="py-3 px-4 text-right font-bold">RONDE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {fighter.fightParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground font-mono-data text-xs">
                      Buku rekor resmi sedang mengarsipkan pertarungan tersertifikasi.
                    </td>
                  </tr>
                ) : (
                  fighter.fightParticipants.map((fp, idx) => {
                    const fight = fp.fight;
                    const opponent = fight.participants.find((p) => p.fighterId !== fighter.id)?.fighter;
                    const isWinner = fight.result?.winnerParticipantId === fp.id;
                    const isEven = idx % 2 === 0;

                    return (
                      <tr
                        key={fp.id}
                        className={`transition-colors hover:bg-fight-red/5 ${
                          isEven ? "bg-card" : "bg-canvas"
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono-data text-xs text-muted-foreground">
                          {new Date(fight.scheduledAt).toLocaleDateString()}
                        </td>

                        <td className="py-3.5 px-4 font-display text-base font-bold text-foreground uppercase">
                          {opponent ? `${opponent.firstName} ${opponent.lastName}` : "TBD"}
                        </td>

                        <td className="py-3.5 px-4 text-muted-foreground font-medium">
                          {fight.event?.name || "Championship Bout"}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono-data text-xs font-black text-fight-red bg-red-500/10">
                          {isWinner ? "MENANG / WIN" : "KALAH / LOSS"}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono-data text-xs text-muted-foreground">
                          {fight.result?.method?.code || "KO"}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono-data text-xs font-bold text-foreground">
                          R{fight.result?.endRound || 12} ({fight.result?.endTime || "3:00"})
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
    </div>
  );
}
