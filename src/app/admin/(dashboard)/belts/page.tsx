import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminBeltsPage() {
  const belts = await prisma.championshipBelt.findMany({
    include: {
      weightClass: true,
      reigns: {
        include: {
          fighter: true,
          defenses: { include: { challenger: true } },
        },
        orderBy: { wonAt: "desc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6 text-ink select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              SANCTIONED TITLES
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {belts.length} WORLD BELTS
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            CHAMPIONSHIP BELT LINEAGE
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Manage rotating divisional belts, certify title transitions, and record mandatory defenses.
          </p>
        </div>

        <div>
          <Button variant="crimson" size="sm" className="font-bold tracking-wider">
            <Plus className="w-4 h-4 mr-1.5" /> CREATE NEW DIVISION BELT
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {belts.map((belt) => {
          const activeReign = belt.reigns.find((r) => r.status === "ACTIVE");
          const historicalReigns = belt.reigns.filter((r) => r.status !== "ACTIVE");

          return (
            <div
              key={belt.id}
              className="bg-charcoal border border-subtle p-6 flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-2xl text-ink font-bold uppercase">
                    {belt.name}
                  </span>
                  <span
                    className={`font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 ${
                      belt.status === "ACTIVE"
                        ? "bg-fight-red text-ink"
                        : "bg-surface-elevated text-ink-muted"
                    }`}
                  >
                    {belt.status}
                  </span>
                </div>

                <p className="font-mono-data text-xs text-ink-muted mb-4">
                  DIVISION: {belt.weightClass.name} ({String(belt.weightClass.limitLbs)} LBS)
                </p>

                {/* Active Holder */}
                <div className="bg-canvas border-l-4 border-fight-red p-4 mb-4">
                  <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-wider block">
                    CURRENT TITLE HOLDER
                  </span>
                  {activeReign ? (
                    <div className="mt-1">
                      <p className="font-display text-2xl text-ink font-black uppercase">
                        {activeReign.fighter.firstName} &quot;{activeReign.fighter.ringName}&quot; {activeReign.fighter.lastName}
                      </p>
                      <p className="font-mono-data text-xs text-ink-muted mt-0.5">
                        Won on: {new Date(activeReign.wonAt).toLocaleDateString()} · Defenses: {activeReign.defenses.length}
                      </p>
                    </div>
                  ) : (
                    <p className="font-display text-2xl text-ink-muted mt-1 uppercase">
                      TITLE VACANT
                    </p>
                  )}
                </div>

                {/* Lineage History */}
                <div className="space-y-2">
                  <span className="font-mono-data text-[10px] text-ink-muted font-bold uppercase tracking-wider block">
                    PAST REIGNS & DEFENSES ({historicalReigns.length})
                  </span>
                  {historicalReigns.length === 0 ? (
                    <p className="font-mono-data text-xs text-ink-subtle italic">
                      Inaugural championship reign active.
                    </p>
                  ) : (
                    historicalReigns.map((hr) => (
                      <div
                        key={hr.id}
                        className="flex items-center justify-between p-2 bg-canvas border border-subtle font-mono-data text-xs"
                      >
                        <span className="text-ink font-bold">
                          {hr.fighter.firstName} {hr.fighter.lastName}
                        </span>
                        <span className="text-ink-subtle">
                          {hr.wonAt ? new Date(hr.wonAt).getFullYear() : ""} - {hr.endedAt ? new Date(hr.endedAt).getFullYear() : "Present"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-subtle flex items-center justify-between font-mono-data text-xs">
                <span className="text-ink-subtle">
                  {belt.nextDefenseNote || "Mandatory Defense Pending"}
                </span>
                <Link href="/belts" className="text-fight-red hover:underline font-bold">
                  View 3D Belt →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
