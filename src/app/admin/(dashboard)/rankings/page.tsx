import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Trophy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminRankingsPage() {
  const versions = await prisma.rankingVersion.findMany({
    include: {
      weightClass: true,
      entries: {
        include: { fighter: true },
        orderBy: [{ isChampion: "desc" }, { rank: "asc" }],
      },
    },
    orderBy: [{ effectiveDate: "desc" }, { versionNumber: "desc" }],
    take: 12,
  });

  return (
    <div className="space-y-6 text-ink select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              SANCTIONING COMMITTEE
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              RATIFIED ENGINE
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            RANKINGS VERSIONING & PUBLICATION
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Manual official rankings staging engine with strict Four-Eyes review and versioned publication.
          </p>
        </div>

        <div>
          <Button variant="crimson" size="sm" className="font-bold tracking-wider">
            <Plus className="w-4 h-4 mr-1.5" /> STAGE NEW RANKING DRAFT
          </Button>
        </div>
      </div>

      {/* Versions List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {versions.map((v) => {
          const champEntry = v.entries.find((e) => e.isChampion);
          const topEntries = v.entries.filter((e) => !e.isChampion).slice(0, 5);

          return (
            <div
              key={v.id}
              className="bg-charcoal border border-subtle p-6 flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-2xl text-ink font-bold uppercase">
                      {v.weightClass?.name || "Pound-for-Pound"}
                    </span>
                    <span className="font-mono-data text-xs text-fight-red font-bold">
                      v{v.versionNumber}.0
                    </span>
                  </div>

                  <span
                    className={`font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 ${
                      v.status === "PUBLISHED"
                        ? "bg-fight-red text-ink"
                        : "bg-surface-elevated text-ink-muted border border-subtle"
                    }`}
                  >
                    {v.status === "PUBLISHED" ? "PUBLISHED · LIVE" : v.status}
                  </span>
                </div>

                <p className="font-mono-data text-xs text-ink-muted mb-4">
                  EFFECTIVE: {new Date(v.effectiveDate).toLocaleDateString()} · {v.notes || "Official Committee Revision"}
                </p>

                {/* Champion Banner */}
                {champEntry && (
                  <div className="bg-canvas border-l-4 border-fight-red p-3 mb-4 flex items-center justify-between">
                    <div>
                      <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-wider block">
                        WORLD CHAMPION
                      </span>
                      <span className="font-display text-xl text-ink font-black uppercase">
                        {champEntry.fighter.firstName} {champEntry.fighter.lastName}
                      </span>
                    </div>
                    <Trophy className="w-5 h-5 text-fight-red" />
                  </div>
                )}

                {/* Top 5 Contenders Mini-Table */}
                <div className="space-y-1.5 font-mono-data text-xs">
                  {topEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-2 bg-canvas border border-subtle"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center font-bold text-ink-muted">
                          #{e.rank}
                        </span>
                        <span className="text-ink font-bold uppercase">
                          {e.fighter.firstName} {e.fighter.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-ink-muted">
                        <span>{e.fighter.wins}-{e.fighter.losses}-{e.fighter.draws}</span>
                        <span className="text-fight-red font-bold">{Number(e.points || 0).toFixed(1)} PTS</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-subtle flex items-center justify-between font-mono-data text-xs">
                <span className="text-ink-subtle">
                  {v.entries.length} Certified Contenders
                </span>
                <Link
                  href="/rankings"
                  className="text-fight-red hover:underline font-bold"
                >
                  View Public Table →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
