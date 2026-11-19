import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Search, ChevronRight, ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function PublicFightersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; division?: string }>;
}) {
  const { q, division } = await searchParams;

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
    status: "ACTIVE",
  };

  if (q) {
    whereClause.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { ringName: { contains: q } },
    ];
  }

  if (division) {
    whereClause.weightClass = { slug: division };
  }

  let fighters: Array<{
    id: string;
    slug: string;
    firstName: string;
    lastName: string;
    ringName: string | null;
    nationality: string;
    wins: number;
    losses: number;
    draws: number;
    koWins: number;
    weightClass: { name: string; slug?: string };
    currentRankings: Array<{ isChampion: boolean }>;
    portrait?: { url: string } | null;
  }> = [];

  let weightClasses: Array<{ id: string; name: string; slug: string }> = [];

  try {
    const [dbFighters, dbWeightClasses] = await Promise.all([
      prisma.fighter.findMany({
        where: whereClause,
        include: {
          weightClass: true,
          currentRankings: true,
          portrait: true,
        },
        orderBy: [{ wins: "desc" }, { lastName: "asc" }],
        take: 4, // Tampilkan 4 saja sesuai permintaan
      }),
      prisma.weightClass.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);
    fighters = dbFighters;
    weightClasses = dbWeightClasses;
  } catch (err) {
    console.error("PublicFightersPage query error:", err);
  }

  // Jika database belum ada fighter baru, sediakan 4 slot default COMING SOON
  if (fighters.length === 0) {
    fighters = [
      {
        id: "cs-1",
        slug: "coming-soon-1",
        firstName: "COMING",
        lastName: "SOON",
        ringName: "ROSTER TFN",
        nationality: "ID",
        wins: 0,
        losses: 0,
        draws: 0,
        koWins: 0,
        weightClass: { name: "Bantamweight" },
        currentRankings: [],
        portrait: { url: "/images/fighters/coming-soon-card.jpg" },
      },
      {
        id: "cs-2",
        slug: "coming-soon-2",
        firstName: "COMING",
        lastName: "SOON",
        ringName: "ROSTER TFN",
        nationality: "ID",
        wins: 0,
        losses: 0,
        draws: 0,
        koWins: 0,
        weightClass: { name: "Featherweight" },
        currentRankings: [],
        portrait: { url: "/images/fighters/coming-soon-card.jpg" },
      },
      {
        id: "cs-3",
        slug: "coming-soon-3",
        firstName: "COMING",
        lastName: "SOON",
        ringName: "ROSTER TFN",
        nationality: "ID",
        wins: 0,
        losses: 0,
        draws: 0,
        koWins: 0,
        weightClass: { name: "Welterweight" },
        currentRankings: [],
        portrait: { url: "/images/fighters/coming-soon-card.jpg" },
      },
      {
        id: "cs-4",
        slug: "coming-soon-4",
        firstName: "COMING",
        lastName: "SOON",
        ringName: "ROSTER TFN",
        nationality: "ID",
        wins: 0,
        losses: 0,
        draws: 0,
        koWins: 0,
        weightClass: { name: "Heavyweight" },
        currentRankings: [],
        portrait: { url: "/images/fighters/coming-soon-card.jpg" },
      },
    ];
  }

  return (
    <div className="bg-canvas min-h-screen text-ink">
      {/* 1. Header Banner */}
      <div
        className="relative bg-cover bg-center py-20 border-b border-border text-center"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="font-display text-4xl sm:text-6xl text-ink uppercase font-black tracking-tight">
            DIREKTORI PETARUNG TFN
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted mt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">
              BERANDA / HOME
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">DIREKTORI ATLET & PETARUNG</span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Division Toolbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="bg-card border border-border p-4 flex flex-wrap items-center justify-between gap-4">
          <form
            action="/fighters"
            className="flex min-h-12 min-w-0 flex-1 items-center gap-2 border border-border bg-canvas px-3 py-2 font-mono-data text-xs text-foreground"
          >
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              name="q"
              aria-label="Cari nama atau julukan petarung"
              placeholder="Cari nama petarung atau julukan... / Search fighter"
              defaultValue={q}
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
            {division && <input type="hidden" name="division" value={division} />}
            <button type="submit" className="min-h-11 shrink-0 px-3 font-bold text-fight-red">
              CARI
            </button>
          </form>

          <div className="flex flex-wrap gap-2 font-mono-data text-xs">
            <Link
              href="/fighters"
              className={`px-3 py-1.5 transition-colors font-bold uppercase ${
                !division
                  ? "bg-fight-red text-ink"
                  : "bg-canvas border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              SEMUA DIVISI
            </Link>
            {weightClasses.map((wc) => (
              <Link
                key={wc.id}
                href={`/fighters?division=${wc.slug}`}
                className={`px-3 py-1.5 transition-colors font-bold uppercase ${
                  division === wc.slug
                    ? "bg-fight-red text-ink"
                    : "bg-canvas border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {wc.name}
              </Link>
            ))}
          </div>
        </div>

        {/* 3. 4-Column Fighter Card Grid (Hanya 4 Kartu Sesuai Permintaan) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {fighters.slice(0, 4).map((f) => {
            const isChamp = f.currentRankings?.some((r) => r.isChampion);
            const isComingSoon =
              f.firstName.toUpperCase() === "COMING" ||
              (f.wins === 0 && f.losses === 0 && f.draws === 0 && f.koWins === 0);

            // Ganti foto petarung menjadi foto siluet/teaser baru
            const photoUrl = f.portrait?.url || "/images/fighters/coming-soon-card.jpg";

            return (
              <div
                key={f.id}
                className="bg-card text-card-foreground border border-border group hover:border-fight-red transition-all flex flex-col justify-between overflow-hidden shadow-lg"
              >
                {/* Fighter Photo */}
                <div className="w-full h-80 relative bg-surface overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={isComingSoon ? "Coming Soon" : `${f.firstName} ${f.lastName}`}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />

                  {isChamp && (
                    <div className="absolute top-3 left-3 bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-md">
                      JUARA / CHAMPION
                    </div>
                  )}

                  <div className="absolute top-3 right-3 bg-canvas/80 border border-subtle text-ink font-mono-data text-[10px] font-bold uppercase px-2 py-0.5">
                    {f.nationality || "ID"}
                  </div>
                </div>

                {/* Bottom Bar: Name, Division, Social Icons (Image 1 style) */}
                <div className="p-5 bg-card text-center border-t border-border space-y-3">
                  <div>
                    <p className="font-mono-data text-[10px] text-fight-red font-bold tracking-widest uppercase">
                      &quot;{f.ringName || (isComingSoon ? "TBA" : "FIGHTER")}&quot;
                    </p>
                    <h3 className="font-display text-xl font-bold uppercase tracking-wider text-card-foreground group-hover:text-fight-red transition-colors">
                      {isComingSoon ? "COMING SOON" : `${f.firstName} ${f.lastName}`}
                    </h3>
                    <p className="font-mono-data text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                      {isComingSoon
                        ? `${f.weightClass.name} · SEGERA DIUMUMKAN`
                        : `${f.weightClass.name} · ${f.wins}W-${f.losses}L-${f.draws}D (${f.koWins} KOs)`}
                    </p>
                  </div>

                  {/* Social Icons Row */}
                  <div className="flex items-center justify-center gap-2 pt-1 text-muted-foreground">
                    <span className="w-6 h-6 rounded-full bg-canvas border border-border hover:bg-fight-red hover:text-ink flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                      f
                    </span>
                    <span className="w-6 h-6 rounded-full bg-canvas border border-border hover:bg-fight-red hover:text-ink flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                      ✆
                    </span>
                    <span className="w-6 h-6 rounded-full bg-canvas border border-border hover:bg-fight-red hover:text-ink flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                      𝕏
                    </span>
                    <span className="w-6 h-6 rounded-full bg-canvas border border-border hover:bg-fight-red hover:text-ink flex items-center justify-center text-[10px] transition-colors cursor-pointer">
                      o
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border">
                    {isComingSoon ? (
                      <div className="flex items-center gap-2 font-mono-data text-xs font-bold text-fight-red">
                        <a
                          href="https://wa.me/6281390823332?text=Halo%20Admin%20TFN%20(Kontak%201),%20saya%20ingin%20mendaftar%20sebagai%20petarung%20di%20Temanggung%20Fight%20Night%20Vol.6%20Exhibition."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-0.5"
                          title="Hubungi Kontak 1 (+62 813-9082-3332)"
                        >
                          <span>DAFTAR WA 1</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                        <span className="text-muted-foreground/40">·</span>
                        <a
                          href="https://wa.me/6285848000639?text=Halo%20Admin%20TFN%20(Kontak%202),%20saya%20ingin%20mendaftar%20sebagai%20petarung%20di%20Temanggung%20Fight%20Night%20Vol.6%20Exhibition."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-0.5"
                          title="Hubungi Kontak 2 (+62 858-4800-0639)"
                        >
                          <span>WA 2</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <Link
                        href={`/fighters/${f.slug}`}
                        className="inline-flex items-center gap-1 font-mono-data text-xs font-bold text-fight-red hover:underline"
                      >
                        <span>LIHAT PROFIL LENGKAP</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
