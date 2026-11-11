import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Belt3DViewer } from "@/components/belts/Belt3DViewer";
import { ChevronRight } from "lucide-react";

export const revalidate = 60;

export default async function PublicBeltsPage() {
  const belts = await prisma.championshipBelt.findMany({
    include: {
      weightClass: true,
      reigns: {
        where: { status: "ACTIVE" },
        include: {
          fighter: true,
          defenses: { include: { challenger: true } },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
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
            SABUK KEJUARAAN RESMI TFN
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted mt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">BERANDA</Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">SABUK KEJUARAAN DUNIA</span>
          </div>
        </div>
      </div>

      {/* 2. Belts Showcase */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {belts.map((belt) => {
          const activeReign = belt.reigns[0];
          const isWelter =
            belt.name.toLowerCase().includes("welter") ||
            belt.weightClass.slug.includes("welter");

          const beltProps = {
            id: belt.id,
            name: belt.name.replace("WBC-X", "TFN"),
            division: belt.weightClass.name,
            status: belt.status,
            holderName: activeReign?.fighter
              ? `${activeReign.fighter.firstName} "${activeReign.fighter.ringName || ""}" ${activeReign.fighter.lastName}`
              : "GELAR KOSONG (VACANT)",
            holderRecord: activeReign?.fighter
              ? `${activeReign.fighter.wins}-${activeReign.fighter.losses}-${activeReign.fighter.draws} (${activeReign.fighter.koWins} KOs)`
              : undefined,
            wonDate: activeReign?.wonAt
              ? new Date(activeReign.wonAt).toLocaleDateString("id-ID")
              : undefined,
            nextDefense: belt.nextDefenseNote || "Menunggu Jadwal Laga Wajib",
            defensesCount: activeReign?.defenses?.length || 0,
            imageUrl: isWelter
              ? "/images/belts/tfn-world-welterweight-belt.jpg"
              : "/images/belts/tfn-world-heavyweight-belt.jpg",
          };

          return <Belt3DViewer key={belt.id} belt={beltProps} />;
        })}
      </div>
    </div>
  );
}
