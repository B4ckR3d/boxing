import React from "react";
import { requirePermission } from "@/lib/permissions/guard";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminGrandPrixPage() {
  await requirePermission("tournaments.manage");
  const tournaments = await prisma.tournament.findMany({
    include: {
      weightClass: true,
      winner: true,
      participants: {
        include: { fighter: true },
        orderBy: { seed: "asc" },
      },
      brackets: {
        include: { bouts: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="crimson">WORLD GRAND PRIX</Badge>
            <Badge variant="outline">BRACKET TOURNAMENT ENGINE</Badge>
          </div>
          <h1 className="font-display text-4xl text-ink uppercase">
            GRAND PRIX TOURNAMENT MANAGEMENT
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Configure single/double elimination tournaments, manage participant seeding, and advance bracket bouts.
          </p>
        </div>

        <div>
          <Button variant="crimson" size="md">
            <Plus className="w-4 h-4 mr-1.5" /> CREATE TOURNAMENT
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tournaments.map((t) => (
          <div
            key={t.id}
            className="bg-charcoal border-[3px] border-hard shadow-brutal-crimson p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-display text-2xl text-ink">
                  {t.name}
                </span>
                <Badge variant={t.status === "IN_PROGRESS" ? "white" : "outline"}>
                  {t.status}
                </Badge>
              </div>

              <p className="font-mono-data text-xs text-ink-muted mb-4">
                DIVISION: {t.weightClass.name} · FORMAT: {t.format.replace("_", " ")} ({t.size}-MAN BRACKET)
              </p>

              {t.prize && (
                <div className="p-3 bg-canvas border border-fight-red mb-4 font-mono-data text-xs">
                  <span className="text-fight-red font-bold">PURSE / PRIZE:</span>{" "}
                  <span className="text-ink">{t.prize}</span>
                </div>
              )}

              {/* Seeded Participants Preview */}
              <div>
                <p className="font-mono-data text-xs text-ink-muted font-bold uppercase tracking-wider mb-2 border-b border-subtle pb-1">
                  SEEDED PARTICIPANTS ({t.participants.length}/{t.size})
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono-data text-xs">
                  {t.participants.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 bg-canvas border border-subtle flex items-center justify-between"
                    >
                      <span className="text-ink font-medium truncate">
                        {p.fighter.firstName} {p.fighter.lastName}
                      </span>
                      <span className="font-bold text-fight-red text-[10px]">
                        SEED #{p.seed}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-subtle flex items-center justify-between font-mono-data text-xs">
              <Button variant="outline" size="sm">
                ADVANCE BRACKET BOUTS
              </Button>
              <Link
                href={`/grand-prix/${t.slug}`}
                target="_blank"
                className="font-bold text-fight-red hover:underline"
              >
                PUBLIC BRACKET →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

