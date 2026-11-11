import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, ChevronRight } from "lucide-react";

export const revalidate = 60;

export default async function PublicEventsPage() {
  const events = await prisma.event.findMany({
    where: { isPublished: true },
    include: {
      poster: true,
      fights: {
        include: {
          weightClass: true,
          belt: true,
          participants: { include: { fighter: true } },
        },
        orderBy: [{ isMainEvent: "desc" }, { boutOrder: "asc" }],
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return (
    <div className="bg-canvas min-h-screen text-ink select-none transition-colors">
      {/* 1. Dark Arena Top Header Banner (From Reference Image 5) */}
      <div
        className="relative bg-cover bg-center py-20 border-b border-subtle text-center"
        style={{
          backgroundImage: "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="font-display text-4xl sm:text-6xl text-ink uppercase font-black tracking-tight">
            JADWAL EVENT TEMANGGUNG FIGHT NIGHT
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted mt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">BERANDA</Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">JADWAL PERTANDINGAN TFN</span>
          </div>
        </div>
      </div>

      {/* 2. 3x2 Grid of Event Cards with Red Date Badge (From Reference Image 5) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((evt) => {
            const mainFight = evt.fights.find((f) => f.isMainEvent) || evt.fights[0];
            const eventDate = new Date(evt.startsAt);
            const dayNum = eventDate.getDate();
            const monthStr = eventDate.toLocaleString("id-ID", { month: "short" }).toUpperCase();

            return (
              <div
                key={evt.id}
                className="bg-charcoal text-ink border-subtle overflow-hidden shadow-lg group hover:shadow-2xl transition-all flex flex-col justify-between"
              >
                {/* Image Container with Red Date Badge (From Image 5) */}
                <div className="relative h-60 w-full overflow-hidden bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evt.poster?.url || "/images/hero/boxing-ring-arena.jpg"}
                    alt={evt.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Square Red Date Badge Floating on Top-Left (From Reference Image 5) */}
                  <div className="absolute top-4 left-4 bg-fight-red text-ink p-2.5 text-center min-w-[50px] shadow-md leading-tight">
                    <Calendar className="w-3.5 h-3.5 mx-auto mb-1 opacity-90" />
                    <span className="font-display text-base font-black block leading-none">{dayNum}</span>
                    <span className="font-mono-data text-[10px] font-bold block uppercase tracking-wider">{monthStr}</span>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-4 right-4 bg-canvas/80 text-ink font-mono-data text-[10px] font-bold uppercase px-2 py-0.5">
                    {evt.status === "SCHEDULED" ? "TERJADWAL" : evt.status}
                  </div>
                </div>

                {/* Content Container */}
                <div className="p-6 flex flex-col justify-between flex-1 space-y-4">
                  <div>
                    {mainFight?.isTitleFight && (
                      <span className="inline-block bg-canvas text-ink font-mono-data text-[9px] font-black uppercase px-2 py-0.5 mb-2">
                        PEREBUTAN GELAR JUARA DUNIA
                      </span>
                    )}

                    <h3 className="font-display text-xl sm:text-2xl font-black uppercase text-ink group-hover:text-fight-red transition-colors leading-snug">
                      {evt.name}
                    </h3>

                    <div className="space-y-1 mt-3 font-mono-data text-xs text-ink-subtle">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-fight-red" />
                        <span className="truncate">{evt.venue || "Gedung Pemuda"}, {evt.city || "Temanggung"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-fight-red" />
                        <span>
                          {eventDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}{" "}
                          WIB (Waktu Indonesia Barat)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Red Action Link (Image 5 style: -> MORE) */}
                  <div className="pt-4 border-t border-subtle flex items-center justify-between">
                    <Link
                      href="/events"
                      className="inline-flex items-center gap-1.5 font-display text-xs font-black uppercase text-fight-red hover:underline"
                    >
                      <span>→ DETAIL LENGKAP</span>
                    </Link>

                    <Button variant="crimson" size="sm" className="font-bold text-[10px] px-3 py-1">
                      BELI TIKET
                    </Button>
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
