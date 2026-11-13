import React from "react";
import { prisma } from "@/lib/db/prisma";
import { HeroSlider } from "@/components/landing/HeroSlider";
import { SponsorRibbon } from "@/components/landing/SponsorRibbon";
import { OfficialSupport } from "@/components/landing/OfficialSupport";
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
    include: { fighterImage: true, background: true },
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

  // Local visual assets are illustrative, not verified fight announcements.
  const defaultHeroSlides = [
    {
      id: "demo-arena", isDemo: true,
      eventTitle: "TEMANGGUNG FIGHT NIGHT",
      headline: "DARI TEMANGGUNG. UNTUK SANG PETARUNG.",
      description: "Kenali para petarung, jelajahi arena TFN, dan temukan informasi acara serta pemesanan tiket dalam satu tempat.",
      fighterImageUrl: "/images/hero/hero_fighter_1_marcus.jpg",
      ctaSecondaryLabel: "JELAJAHI ACARA", ctaSecondaryHref: "/events",
      overlay: "GOLD" as const,
    },
    {
      id: "demo-roster", isDemo: true,
      eventTitle: "DI BALIK SETIAP RONDE",
      headline: "DISIPLIN. NYALI. IDENTITAS.",
      description: "Jelajahi profil dan catatan petarung di roster TFN. Materi visual pada pratinjau ini merupakan ilustrasi, bukan pengumuman laga.",
      fighterImageUrl: "/images/hero/hero_fighter_3_kenji.jpg",
      ctaSecondaryLabel: "KENALI PETARUNG", ctaSecondaryHref: "/fighters",
      overlay: "CRIMSON" as const,
    },
  ];

  const activeHeroSlides =
    heroSlides.length > 0
      ? heroSlides.map((s) => ({
          id: s.id,
          isDemo: true,
          eventTitle: s.eventTitle,
          category: s.category,
          headline: s.headline,
          description: s.description,
          eventDate: s.eventDate ? s.eventDate.toISOString() : null,
          fighterImageUrl: s.fighterImage?.url || "/images/hero/hero_fighter_1_marcus.jpg",
          backgroundImageUrl: s.background?.url || "/images/hero/boxing-ring-arena.jpg",
          ctaPrimaryLabel: s.ctaPrimaryLabel || "BACA SELENGKAPNYA",
          ctaPrimaryHref: s.ctaPrimaryHref || "/events",
          ctaSecondaryLabel: s.ctaSecondaryLabel || "LIHAT AGENDA",
          ctaSecondaryHref: s.ctaSecondaryHref || "/rankings",
          overlay: s.overlay,
        }))
      : defaultHeroSlides;

  return (
    <div className="space-y-0">
      {/* 1. Cinematic Hero Slider (Reference Image 2 & 3 with 5 Fighter Slides) */}
      <HeroSlider slides={activeHeroSlides} />

      {/* 2. TFN identity ribbon; no unverified sponsor claims. */}
      <SponsorRibbon />

      {/* 2b. Official event / government backing — sourced from src/lib/site/partners.ts */}
      <OfficialSupport variant="home" />

      {/* 3. Public discovery links */}
      <FightHighlights />

      {/* 4. Editorial introduction */}
      <MatchupShowcase />

      {/* Only show published rankings, never a fabricated version. */}
      {hwVersion && <RankingPreview
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
      />}

      {/* 6. 3D Championship Belt Section */}
      {hwBelt && <section className="py-20 bg-canvas border-b border-subtle relative bg-spotlight transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BeltSectionHeader />
          <Belt3DViewer belt={beltProps} />
        </div>
      </section>}

      {/* 7. Active Grand Prix Tournament Bracket */}
      {tournamentProps && <GrandPrixPreview tournament={tournamentProps} />}

      {/* 8. Elite Roster Athletes & Social Grid (Reference Image 1) */}
      <FeaturedFighters fighters={fightersProps} />
    </div>
  );
}
