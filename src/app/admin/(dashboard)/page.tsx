import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import {
  Users,
  Trophy,
  Calendar,
  Swords,
  Award,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // Live Operational Metrics from MySQL
  const [
    totalFighters,
    activeFighters,
    publishedRankings,
    upcomingEvents,
    activeTournaments,
    championshipBelts,
    recentAudits,
  ] = await Promise.all([
    prisma.fighter.count({ where: { deletedAt: null } }),
    prisma.fighter.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.rankingVersion.count({ where: { status: "PUBLISHED" } }),
    prisma.event.count({
      where: { startsAt: { gte: new Date() }, status: "SCHEDULED" },
    }),
    prisma.tournament.count({ where: { status: "IN_PROGRESS" } }),
    prisma.championshipBelt.count(),
    prisma.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { actor: true },
    }),
  ]);

  const metricCards = [
    {
      title: "TOTAL FIGHTERS",
      value: totalFighters,
      sub: `${activeFighters} Active Roster`,
      icon: Users,
      href: "/admin/fighters",
    },
    {
      title: "PUBLISHED RANKINGS",
      value: publishedRankings,
      sub: "Official Staging Verified",
      icon: Trophy,
      href: "/admin/rankings",
    },
    {
      title: "UPCOMING EVENTS",
      value: upcomingEvents,
      sub: "Scheduled Fight Nights",
      icon: Calendar,
      href: "/admin/events",
    },
    {
      title: "ACTIVE GRAND PRIX",
      value: activeTournaments,
      sub: "Tournaments In Progress",
      icon: Swords,
      href: "/admin/grand-prix",
    },
    {
      title: "CHAMPIONSHIP BELTS",
      value: championshipBelts,
      sub: "Divisional Titles Tracked",
      icon: Award,
      href: "/admin/belts",
    },
  ];

  return (
    <div className="space-y-8 text-ink select-none">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              COMMISSION COMMAND
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              MYSQL CONNECTED
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            CMS CONTROL ROOM
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Real-time operations center for fighters, divisional rankings, championship belts, and events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-mono-data text-xs font-bold text-ink-muted hover:text-ink border border-subtle hover:border-ink-muted px-4 py-2 transition-colors"
          >
            Public Site ↗
          </Link>
          <Link
            href="/admin/fighters"
            className="font-mono-data text-xs font-bold bg-fight-red hover:bg-red-700 text-ink px-4 py-2 transition-colors"
          >
            + Manage Fighters
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricCards.map((m, idx) => {
          const Icon = m.icon;
          return (
            <Link
              key={idx}
              href={m.href}
              className="bg-charcoal border border-subtle hover:border-fight-red p-5 transition-all shadow-md group"
            >
              <div className="flex items-center justify-between text-ink-muted mb-3">
                <span className="font-mono-data text-[10px] font-bold uppercase tracking-wider">
                  {m.title}
                </span>
                <Icon className="w-4 h-4 text-ink-subtle group-hover:text-fight-red transition-colors" />
              </div>
              <p className="font-display text-4xl text-ink font-black">
                {m.value}
              </p>
              <p className="font-mono-data text-[10px] text-ink-muted mt-1">
                {m.sub}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Recent Cryptographic Audit Logs */}
      <div className="bg-charcoal border border-subtle p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-subtle pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-fight-red" />
            <h2 className="font-display text-xl text-ink uppercase font-black">
              RECENT SYSTEM AUDIT LOGS
            </h2>
          </div>
          <Link
            href="/admin/audit-logs"
            className="font-mono-data text-xs text-fight-red hover:underline font-bold"
          >
            VIEW FULL AUDIT TRAIL →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-data text-xs border-collapse">
            <thead>
              <tr className="border-b border-subtle text-ink-muted uppercase text-[10px]">
                <th className="py-2.5 px-3">TIMESTAMP</th>
                <th className="py-2.5 px-3">OPERATOR</th>
                <th className="py-2.5 px-3">ACTION</th>
                <th className="py-2.5 px-3">ENTITY</th>
                <th className="py-2.5 px-3">SUMMARY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60">
              {recentAudits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-subtle">
                    No administrative audit actions recorded yet.
                  </td>
                </tr>
              ) : (
                recentAudits.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-elevated transition-colors">
                    <td className="py-3 px-3 text-ink-muted">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-ink font-bold">
                      {a.actor?.name || "System Automated"}
                    </td>
                    <td className="py-3 px-3 text-fight-red font-bold">
                      {a.action}
                    </td>
                    <td className="py-3 px-3 text-ink-muted">
                      {a.entityType}
                    </td>
                    <td className="py-3 px-3 text-ink-muted">
                      {a.summary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
