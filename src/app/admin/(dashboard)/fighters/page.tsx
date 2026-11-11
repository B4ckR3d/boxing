import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminFightersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; division?: string }>;
}) {
  const { q, division } = await searchParams;

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
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

  const [fighters, weightClasses] = await Promise.all([
    prisma.fighter.findMany({
      where: whereClause,
      include: {
        weightClass: true,
        currentRankings: true,
      },
      orderBy: [{ wins: "desc" }, { lastName: "asc" }],
    }),
    prisma.weightClass.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 text-ink select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              FIGHTER DATABASE
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {fighters.length} ATHLETES
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            ROSTER & ATHLETE MANAGEMENT
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Manage official registered combatants, verified fight metrics, and weight class assignments.
          </p>
        </div>

        <div>
          <Link href="/admin/fighters">
            <Button variant="crimson" size="sm" className="font-bold tracking-wider">
              <Plus className="w-4 h-4 mr-1.5" /> REGISTER FIGHTER
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-charcoal p-4 border border-subtle">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-canvas border border-subtle px-3 py-1.5">
          <Search className="w-4 h-4 text-ink-subtle" />
          <input
            type="text"
            placeholder="Search fighter by name or alias..."
            defaultValue={q}
            className="w-full bg-transparent text-sm font-mono-data text-ink outline-none placeholder:text-ink-subtle"
          />
        </div>

        <div className="flex flex-wrap gap-2 font-mono-data text-xs">
          <Link
            href="/admin/fighters"
            className={`px-3 py-1.5 transition-colors font-bold uppercase ${
              !division ? "bg-fight-red text-ink" : "border border-subtle text-ink-muted hover:text-ink"
            }`}
          >
            ALL DIVISIONS
          </Link>
          {weightClasses.slice(0, 4).map((wc) => (
            <Link
              key={wc.id}
              href={`/admin/fighters?division=${wc.slug}`}
              className={`px-3 py-1.5 transition-colors font-bold uppercase ${
                division === wc.slug
                  ? "bg-fight-red text-ink"
                  : "border border-subtle text-ink-muted hover:text-ink"
              }`}
            >
              {wc.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Fighters Data Table */}
      <div className="bg-charcoal border border-subtle overflow-x-auto shadow-xl">
        <table className="w-full text-left font-sans text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-subtle bg-canvas font-display text-xs text-ink-muted uppercase tracking-wider">
              <th className="py-3 px-4">FIGHTER</th>
              <th className="py-3 px-4">DIVISION</th>
              <th className="py-3 px-4">RECORD</th>
              <th className="py-3 px-4">STANCE</th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/60">
            {fighters.map((f) => {
              const isChamp = f.currentRankings.some((r) => r.isChampion);
              return (
                <tr key={f.id} className="hover:bg-surface-elevated transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-data text-xs bg-surface-elevated text-ink px-1.5 py-0.5 border border-subtle font-bold">
                        {f.nationality}
                      </span>
                      <div>
                        <Link
                          href={`/fighters/${f.slug}`}
                          className="font-display text-base font-bold text-ink hover:text-fight-red transition-colors uppercase"
                        >
                          {f.firstName} {f.lastName}
                        </Link>
                        {f.ringName && (
                          <span className="block font-mono-data text-[10px] text-fight-red font-bold uppercase">
                            &quot;{f.ringName}&quot;
                          </span>
                        )}
                      </div>
                      {isChamp && (
                        <span className="bg-fight-red text-ink font-mono-data text-[9px] font-bold px-1.5 py-0.2 uppercase ml-2">
                          CHAMPION
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono-data text-xs text-ink-muted">
                    {f.weightClass.name}
                  </td>

                  <td className="py-3.5 px-4 font-mono-data text-xs font-bold text-ink">
                    {f.wins}-{f.losses}-{f.draws} ({f.koWins} KOs)
                  </td>

                  <td className="py-3.5 px-4 font-mono-data text-xs text-ink-muted">
                    {f.stance}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 ${
                        f.status === "ACTIVE"
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                          : "bg-surface-elevated text-ink-muted border border-subtle"
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/fighters/${f.slug}`}
                      className="font-mono-data text-xs font-bold text-fight-red hover:underline"
                    >
                      View Profile →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
