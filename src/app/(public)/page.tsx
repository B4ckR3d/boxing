import React from "react";
import { prisma } from "@/lib/db/prisma";
import { HeroSlider } from "@/components/landing/HeroSlider";
import { SponsorRibbon } from "@/components/landing/SponsorRibbon";
import { FightHighlights } from "@/components/landing/FightHighlights";
import { MatchupShowcase } from "@/components/landing/MatchupShowcase";
import { RankingPreview } from "@/components/rankings/RankingPreview";
import { Belt3DViewer } from "@/components/belts/Belt3DViewer";
import { BeltSectionHeader } from "@/components/belts/BeltSectionHeader";
import { GrandPrixPreview } from "@/components/tournaments/GrandPrixPreview";
import { FeaturedFighters } from "@/components/fighters/FeaturedFighters";

export const revalidate = 60; // ISR cache revalidation window

export default async function PublicHomePage() {
  // 1. Fetch Active Hero Slides
  const heroSlides = await prisma.heroSlide.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  // 2. Fetch Latest Published Heavyweight Ranking Version & Entries
  const hwVersion = await prisma.rankingVersion.findFirst({
    where: {
      type: "DIVISION",
      status: "PUBLISHED",
      weightClass: { slug: "heavyweight" },
    },
    orderBy: { versionNumber: "desc" },
    include: {
      weightClass: true,
      entries: {
        include: {
          fighter: {
            include: { weightClass: true },
          },
        },
        orderBy: [
          { isChampion: "desc" },
          { rank: "asc" },
        ],
      },
    },
  });

  // 3. Fetch Heavyweight Championship Belt and Active Reign
  const hwBelt = await prisma.championshipBelt.findFirst({
    where: { slug: "wbc-x-world-heavyweight-championship" },
    include: {
      weightClass: true,
      reigns: {
        where: { status: "ACTIVE" },
        include: {
          fighter: true,
          defenses: true,
        },
      },
    },
  });

  // 4. Fetch Active Grand Prix Tournament
  const tournament = await prisma.tournament.findFirst({
    where: { isPublished: true },
    include: {
      weightClass: true,
      brackets: {
        include: {
          bouts: {
            include: {
              participantA: { include: { fighter: true } },
              participantB: { include: { fighter: true } },
              winner: { include: { fighter: true } },
            },
          },
        },
      },
    },
  });

  // 5. Fetch Featured Roster Fighters
  const featuredFighters = await prisma.fighter.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    include: { weightClass: true, currentRankings: true },
    take: 6,
    orderBy: [{ wins: "desc" }],
  });

  // Transform Belt Props
  const activeReign = hwBelt?.reigns[0];
  const beltProps = {
    id: hwBelt?.id || "hw-belt",
    name:
      (hwBelt?.name.replace("WBC-X", "TFN") || "TFN Heavyweight Championship").replace(
        /\bworld\b\s*/gi,
        ""
      ),
    division: hwBelt?.weightClass?.name || "Heavyweight",
    status: hwBelt?.status || "ACTIVE",
    holderName: activeReign?.fighter
      ? `${activeReign.fighter.firstName} "${activeReign.fighter.ringName || ""}" ${activeReign.fighter.lastName}`
      : "GELAR KOSONG (VACANT)",
    holderRecord: activeReign?.fighter
      ? `${activeReign.fighter.wins}-${activeReign.fighter.losses}-${activeReign.fighter.draws} (${activeReign.fighter.koWins} KOs)`
      : undefined,
    wonDate: activeReign?.wonAt ? new Date(activeReign.wonAt).toLocaleDateString("id-ID") : undefined,
    nextDefense: hwBelt?.nextDefenseNote || "Menunggu Jadwal Laga Wajib",
    defensesCount: activeReign?.defenses?.length || 0,
    imageUrl: "/images/belts/tfn-world-heavyweight-belt.jpg",
  };

  // Transform Ranking Entries
  const rankingEntries =
    hwVersion?.entries.map((e) => ({
      fighterId: e.fighterId,
      fighterName: `${e.fighter.firstName} ${e.fighter.lastName}`,
      fighterSlug: e.fighter.slug,
      record: `${e.fighter.wins}-${e.fighter.losses}-${e.fighter.draws}`,
      rank: e.rank,
      isChampion: e.isChampion,
      points: e.points ? Number(e.points) : null,
      movement: e.movement,
      isNew: e.isNew,
      weightClassName: e.fighter.weightClass.name,
      nationality: e.fighter.nationality,
    })) || [];

  // Transform Tournament Props
  const tournamentProps = tournament
    ? {
      id: tournament.id,
      slug: tournament.slug,
      name: tournament.name,
      division: tournament.weightClass.name,
      prize: tournament.prize,
      titleAwarded: tournament.titleAwarded,
      size: tournament.size,
      status: tournament.status,
      bouts: (tournament.brackets[0]?.bouts || []).map((b) => ({
        round: b.round,
        position: b.position,
        fighterAName: b.participantA?.fighter
          ? `${b.participantA.fighter.firstName} ${b.participantA.fighter.lastName}`
          : "TBD",
        fighterBName: b.participantB?.fighter
          ? `${b.participantB.fighter.firstName} ${b.participantB.fighter.lastName}`
          : "TBD",
        winnerName: b.winner?.fighter
          ? `${b.winner.fighter.firstName} ${b.winner.fighter.lastName}`
          : undefined,
        status: b.status,
      })),
    }
    : null;

  // Fighter image mapping dictionary
  const fighterImages: Record<string, string> = {
    "marcus-iron-vale": "/images/fighters/marcus-vale.jpg",
    "dario-storm": "/images/fighters/dario-storm.jpg",
    "kenji-arata": "/images/fighters/kenji-arata.jpg",
    "tomas-reyes": "/images/fighters/tomas-reyes.jpg",
  };

  // Transform Fighter Cards
  const fightersProps = featuredFighters.map((f) => ({
    id: f.id,
    slug: f.slug,
    fullName: `${f.firstName} ${f.lastName}`,
    ringName: f.ringName,
    division: f.weightClass.name,
    record: `${f.wins}-${f.losses}-${f.draws}`,
    koWins: f.koWins,
    totalWins: f.wins,
    stance: f.stance,
    nationality: f.nationality,
    isChampion: f.currentRankings.some((r) => r.isChampion),
    imageUrl: fighterImages[f.slug] || null,
  }));

  // 5 Fighter Hero Slides (Generated with Gemini per reference images)
  const defaultHeroSlides = [
    {
      id: "hero-1-marcus",
      eventTitle: "TFN 01 · GEDUNG PEMUDA TEMANGGUNG",
      category: "PEREBUTAN GELAR JUARA DUNIA",
      headline: "MARCUS VALE: SANG RAJA TAK TERKALAHKAN",
      description: "Marcus 'Iron' Vale mempertaruhkan rekor tak terkalahkannya dalam duel sengit 12 ronde perebutan sabuk emas kelas berat paling prestisius di Temanggung.",
      fighterName: "Marcus 'Iron' Vale",
      fighterImageUrl: "/images/hero/hero_fighter_1_marcus.jpg",
      backgroundImageUrl: "/images/hero/boxing-ring-arena.jpg",
      eventDate: "2026-12-24T19:00:00Z",
      ctaPrimaryLabel: "BACA SELENGKAPNYA",
      ctaPrimaryHref: "/events",
      ctaSecondaryLabel: "LIHAT FIGHT CARD",
      ctaSecondaryHref: "/rankings",
      overlay: "GOLD" as const,
    },
    {
      id: "hero-2-dario",
      eventTitle: "TFN 01 · MAIN EVENT ELIMINATION",
      category: "KONTENDER NOMOR SATU",
      headline: "DARIO STORM: MESIN KO BERHATI DINGIN",
      description: "Dengan rekor 8 kemenangan KO beruntun yang menggetarkan, Dario Storm bertekad menumbangkan takhta sang juara dunia dan merebut tahta tertinggi.",
      fighterName: "Dario 'The Storm' Rossi",
      fighterImageUrl: "/images/hero/hero_fighter_2_dario.jpg",
      backgroundImageUrl: "/images/hero/boxing-ring-arena.jpg",
      eventDate: "2026-12-24T19:00:00Z",
      ctaPrimaryLabel: "PROFIL KONTENDER",
      ctaPrimaryHref: "/fighters/dario-storm",
      ctaSecondaryLabel: "BELI TIKET",
      ctaSecondaryHref: "/events",
      overlay: "CRIMSON" as const,
    },
    {
      id: "hero-3-kenji",
      eventTitle: "TFN 01 · CO-MAIN EVENT",
      category: "DUEL ELITE DIVISI MENENGAH",
      headline: "KENJI ARATA: KECEPATAN & PRESISI MEMATIKAN",
      description: "Striking tanpa cela dan reflek serangan balik kilat Kenji Arata siap mengguncang ring tinju Temanggung dalam duel penentuan peringkat dunia.",
      fighterName: "Kenji Arata",
      fighterImageUrl: "/images/hero/hero_fighter_3_kenji.jpg",
      backgroundImageUrl: "/images/hero/boxing-ring-arena.jpg",
      eventDate: "2026-12-24T20:30:00Z",
      ctaPrimaryLabel: "LIHAT STATISTIK",
      ctaPrimaryHref: "/fighters/kenji-arata",
      ctaSecondaryLabel: "JADWAL TANDING",
      ctaSecondaryHref: "/events",
      overlay: "DARK" as const,
    },
    {
      id: "hero-4-tomas",
      eventTitle: "TFN 01 · PERANG KELAS BERAT",
      category: "LAGA ELIMINASI GRAND PRIX",
      headline: "TOMAS REYES: SANG BANTENG PENANTANG GELAR",
      description: "Gaya bertarung agresif tanpa kompromi siap menguji ketahanan mental sang juara bertahan dalam pertarungan 10 ronde penuh tensi tinggi.",
      fighterName: "Tomas 'El Toro' Reyes",
      fighterImageUrl: "/images/hero/hero_fighter_4_tomas.jpg",
      backgroundImageUrl: "/images/hero/boxing-ring-arena.jpg",
      eventDate: "2026-12-24T21:15:00Z",
      ctaPrimaryLabel: "REKOR BERTANDING",
      ctaPrimaryHref: "/fighters/tomas-reyes",
      ctaSecondaryLabel: "BRACKET GRAND PRIX",
      ctaSecondaryHref: "/grand-prix",
      overlay: "CRIMSON" as const,
    },
    {
      id: "hero-5-champion",
      eventTitle: "TFN · SIMBOL SUPREMASI RING",
      category: "MAHKOTA KEJUARAAN DUNIA",
      headline: "SABUK EMAS 24K: PRESTASI TERTINGGI COMBAT",
      description: "Simbol supremasi sejati kejuaraan tinju dunia Temanggung Fight Night. Dihiasi emas 24 karat murni dan permata ruby, hanya untuk yang terbaik.",
      fighterName: "Sabuk Emas TFN",
      fighterImageUrl: "/images/hero/hero_fighter_5_champion.jpg",
      backgroundImageUrl: "/images/hero/boxing-ring-arena.jpg",
      eventDate: "2026-12-24T22:00:00Z",
      ctaPrimaryLabel: "INSPEKSI SABUK 3D",
      ctaPrimaryHref: "/belts",
      ctaSecondaryLabel: "DAFTAR JUARA DUNIA",
      ctaSecondaryHref: "/rankings",
      overlay: "GOLD" as const,
    },
  ];

  return (
    <div className="space-y-0">
      {/* 1. Cinematic Hero Slider (Reference Image 2 & 3 with 5 Fighter Slides) */}
      <HeroSlider slides={defaultHeroSlides} />

      {/* 2. Sponsor Logos Ribbon (Reference Image 2) */}
      <SponsorRibbon />

      {/* 3. News & Highlights 3-Column Cards (Reference Image 2) */}
      <FightHighlights />

      {/* 4. Head-to-Head VS Matchup Showcase & Fight Night Countdown (Reference Image 3) */}
      <MatchupShowcase />

      {/* 5. Official Ranking Table with Red WINS Column (Reference Image 4) */}
      <RankingPreview
        divisionName={hwVersion?.weightClass?.name || "Heavyweight"}
        versionNumber={hwVersion?.versionNumber || 1}
        effectiveDate={
          hwVersion?.effectiveDate
            ? new Date(hwVersion.effectiveDate).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })
            : "Current"
        }
        entries={rankingEntries}
      />

      {/* 6. 3D Championship Belt Section */}
      <section className="py-20 bg-canvas border-b border-subtle relative bg-spotlight transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BeltSectionHeader />
          <Belt3DViewer belt={beltProps} />
        </div>
      </section>

      {/* 7. Active Grand Prix Tournament Bracket */}
      {tournamentProps && <GrandPrixPreview tournament={tournamentProps} />}

      {/* 8. Elite Roster Athletes & Social Grid (Reference Image 1) */}
      <FeaturedFighters fighters={fightersProps} />
    </div>
  );
}
