import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  Trophy,
  Ticket,
  ArrowUpRight,
  Shield,
  Swords,
  CheckCircle2,
  Share2,
} from "lucide-react";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const event = await prisma.event.findUnique({
    where: { slug: decodedSlug },
    include: { poster: true },
  });

  if (!event) {
    return {
      title: "Event Tidak Ditemukan — TFN",
    };
  }

  const dateStr = new Date(event.startsAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    title: `${event.name} — Jadwal & Fight Card Resmi TFN`,
    description:
      event.description ||
      `Informasi resmi pertandingan ${event.name} pada ${dateStr} di ${event.venue || "Gedung Pemuda"}, ${event.city || "Temanggung"}. Dapatkan tiket dan lihat susunan duel petarung.`,
    openGraph: {
      title: `${event.name} | Temanggung Fight Night`,
      description: `Saksikan ${event.name} pada ${dateStr}. Lihat susunan laga perebutan juara dunia dan pesan tiket Anda.`,
      images: event.poster?.url ? [{ url: event.poster.url }] : [],
    },
  };
}

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const event = await prisma.event.findUnique({
    where: { slug: decodedSlug },
    include: {
      poster: true,
      ticketTypes: {
        where: { isActive: true },
        orderBy: { price: "asc" },
      },
      fights: {
        include: {
          weightClass: true,
          belt: true,
          result: {
            include: {
              method: true,
              winner: {
                include: { fighter: true },
              },
            },
          },
          participants: {
            include: {
              fighter: {
                include: {
                  portrait: true,
                  currentRankings: true,
                },
              },
            },
            orderBy: { corner: "asc" }, // RED first, then BLUE
          },
        },
        orderBy: [{ isMainEvent: "desc" }, { boutOrder: "asc" }],
      },
    },
  });

  if (!event) {
    notFound();
  }

  const ticketingUrl =
    process.env.NEXT_PUBLIC_TICKETING_URL ||
    process.env.TICKETING_URL ||
    "https://tiket.pimpom.id";

  const eventDate = new Date(event.startsAt);
  const dayName = eventDate.toLocaleDateString("id-ID", { weekday: "long" });
  const dayNum = eventDate.getDate();
  const monthName = eventDate.toLocaleDateString("id-ID", { month: "long" });
  const monthShort = eventDate.toLocaleDateString("id-ID", { month: "short" }).toUpperCase();
  const yearNum = eventDate.getFullYear();
  const timeFormatted = `${eventDate.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;

  // Pisahkan Main Event & Undercard
  const mainFight = event.fights.find((f) => f.isMainEvent) || event.fights[0];
  const undercardFights = event.fights.filter((f) => f.id !== mainFight?.id);

  const posterImage = event.poster?.url || "/images/hero/boxing-ring-arena.jpg";

  // Status mapping
  const statusConfig: Record<string, { label: string; className: string }> = {
    SCHEDULED: { label: "TERJADWAL", className: "bg-emerald-600/90 text-white" },
    LIVE: { label: "🔴 SEDANG BERLANGSUNG", className: "bg-fight-red text-white animate-pulse" },
    COMPLETED: { label: "SELESAI", className: "bg-neutral-800 text-neutral-300" },
    POSTPONED: { label: "DITUNDA", className: "bg-amber-600 text-white" },
    CANCELLED: { label: "DIBATALKAN", className: "bg-red-950 text-red-200" },
    DRAFT: { label: "DRAFT", className: "bg-neutral-700 text-white" },
  };
  const currentStatus = statusConfig[event.status] || {
    label: event.status,
    className: "bg-surface text-ink",
  };

  return (
    <div className="bg-canvas min-h-screen text-ink select-none transition-colors">
      {/* 1. Header Banner / Breadcrumb */}
      <div
        className="relative bg-cover bg-center py-16 sm:py-24 border-b border-subtle text-center"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted uppercase tracking-widest mb-4 flex-wrap">
            <Link href="/" className="hover:text-ink transition-colors">
              BERANDA
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <Link href="/events" className="hover:text-ink transition-colors">
              JADWAL EVENT
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold truncate max-w-xs sm:max-w-md">
              {event.name}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 mb-4">
            <span
              className={`font-mono-data text-xs font-black uppercase px-3 py-1 shadow-md tracking-wider ${currentStatus.className}`}
            >
              {currentStatus.label}
            </span>
            {mainFight?.isTitleFight && (
              <span className="bg-gold/20 text-gold border border-gold/40 font-mono-data text-xs font-bold uppercase px-3 py-1 tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                <span>PEREBUTAN GELAR JUARA</span>
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl text-ink uppercase font-black tracking-tight max-w-5xl mx-auto leading-tight">
            {event.name}
          </h1>

          {/* Quick Meta Row */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mt-6 font-mono-data text-xs sm:text-sm text-ink-muted flex-wrap">
            <div className="flex items-center gap-2 text-ink">
              <Calendar className="w-4 h-4 text-fight-red" />
              <span>
                {dayName}, {dayNum} {monthName} {yearNum}
              </span>
            </div>
            <div className="flex items-center gap-2 text-ink">
              <Clock className="w-4 h-4 text-fight-red" />
              <span>{timeFormatted}</span>
            </div>
            <div className="flex items-center gap-2 text-ink">
              <MapPin className="w-4 h-4 text-fight-red" />
              <span>
                {event.venue || "Gedung Pemuda"}, {event.city || "Temanggung"}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href={ticketingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2.5 bg-fight-red hover:bg-fight-red-hover text-white font-bold uppercase tracking-wider text-sm shadow-xl px-8 py-3 transition-transform hover:scale-105 active:scale-95"
            >
              <Ticket className="w-4 h-4" />
              <span>BELI TIKET RESMI</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>

            <a
              href="#fight-card"
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-border-hard bg-charcoal/80 hover:bg-surface text-ink font-bold uppercase tracking-wider text-sm px-6 py-3 transition-colors"
            >
              <Swords className="w-4 h-4 text-fight-red" />
              <span>SUSUNAN FIGHT CARD</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Section: Overview & Official Poster */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Poster Card (5 Cols) */}
          <div className="lg:col-span-5 bg-charcoal border border-subtle overflow-hidden shadow-2xl">
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterImage}
                alt={event.name}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute top-4 left-4 bg-fight-red text-white p-3 text-center min-w-[60px] shadow-lg leading-tight">
                <Calendar className="w-4 h-4 mx-auto mb-1 opacity-90" />
                <span className="font-display text-xl font-black block leading-none">{dayNum}</span>
                <span className="font-mono-data text-xs font-bold block uppercase tracking-wider">
                  {monthShort}
                </span>
              </div>
            </div>
            <div className="p-4 bg-surface/50 border-t border-subtle flex items-center justify-between text-xs font-mono-data text-ink-muted">
              <span>POSTER RESMI TFN</span>
              <span className="text-fight-red font-bold">TEMANGGUNG FIGHT NIGHT</span>
            </div>
          </div>

          {/* Overview Info (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-charcoal border border-subtle p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="border-b border-subtle pb-4">
                <span className="font-mono-data text-xs text-fight-red font-bold uppercase tracking-widest block mb-1">
                  RINGKASAN ACARA
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-black uppercase text-ink">
                  TENTANG PERTANDINGAN
                </h2>
              </div>

              <div className="text-sm sm:text-base leading-relaxed text-ink-muted whitespace-pre-line">
                {event.description ||
                  "Temanggung Fight Night (TFN) menghadirkan duel sengit para petarung terbaik dalam kejuaraan tinju profesional paling bergengsi di Temanggung. Saksikan aksi menegangkan langsung di arena dan dukung atlet favorit Anda."}
              </div>

              {/* Event Schedule & Gate Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-subtle font-mono-data text-xs">
                <div className="bg-surface/60 p-4 border border-subtle space-y-1">
                  <span className="text-ink-subtle uppercase block">PINTU ARENA DIBUKA / GATE OPEN</span>
                  <p className="text-ink font-bold text-sm">17:00 WIB</p>
                  <p className="text-ink-muted text-[11px]">Pemeriksaan tiket dan akses masuk penonton</p>
                </div>
                <div className="bg-surface/60 p-4 border border-subtle space-y-1">
                  <span className="text-ink-subtle uppercase block">LAGA PERDANA / FIRST BOUT</span>
                  <p className="text-ink font-bold text-sm">{timeFormatted}</p>
                  <p className="text-ink-muted text-[11px]">Partai pembuka undurcard dimulai</p>
                </div>
              </div>

              {/* Location Card */}
              <div className="bg-surface/40 p-5 border border-subtle flex items-start gap-3.5">
                <MapPin className="w-5 h-5 text-fight-red shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-display text-sm font-bold uppercase text-ink">
                    LOKASI ARENA PERTANDINGAN
                  </p>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    {event.venue || "Gedung Pemuda Temanggung"}
                    {event.city ? `, ${event.city}` : ""}, Jawa Tengah, Indonesia
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${event.venue || "Gedung Pemuda"} ${event.city || "Temanggung"}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-fight-red hover:underline font-mono-data pt-1"
                  >
                    <span>Buka Peta Google Maps</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Ticket CTA Banner */}
            <div className="bg-gradient-to-r from-fight-red to-red-800 p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center sm:text-left">
                <p className="font-mono-data text-xs font-bold tracking-widest uppercase opacity-90">
                  TIKET RESMI TEMANGGUNG FIGHT NIGHT
                </p>
                <h3 className="font-display text-2xl font-black uppercase">
                  DAPATKAN TIKET ANDA SEKARANG
                </h3>
                <p className="text-xs opacity-90">
                  Tempat duduk terbatas! Amankan tiket Anda sebelum kehabisan.
                </p>
              </div>
              <Link
                href={ticketingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 bg-white hover:bg-neutral-100 text-charcoal font-display font-black text-sm uppercase px-6 py-3 tracking-wider shadow-lg transition-transform hover:scale-105 active:scale-95 inline-flex items-center gap-2"
              >
                <Ticket className="w-4 h-4 text-fight-red" />
                <span>PESAN TIKET</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Section: Main Event Spotlight (Headliner Face-Off) */}
        {mainFight && (
          <section id="main-event" className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-fight-red/10 border border-fight-red/30 px-3 py-1 font-mono-data text-xs font-bold text-fight-red uppercase tracking-widest">
                <Swords className="w-4 h-4" />
                <span>PARTAI UTAMA · HEADLINE BOUT</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-ink">
                MAIN EVENT FIGHT CARD
              </h2>
              {mainFight.weightClass && (
                <p className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
                  {mainFight.weightClass.name} · {mainFight.scheduledRounds} RONDE
                </p>
              )}
            </div>

            {/* Face-off Duel Card */}
            <div className="bg-charcoal border-2 border-subtle overflow-hidden shadow-2xl">
              {/* Title Fight Bar */}
              {mainFight.isTitleFight && (
                <div className="bg-gradient-to-r from-gold/20 via-gold/40 to-gold/20 border-b border-gold/40 py-2.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-2 font-display text-xs sm:text-sm font-black uppercase text-gold tracking-widest">
                    <Trophy className="w-4 h-4 text-gold" />
                    <span>
                      {mainFight.belt?.name || "PEREBUTAN SABUK EMAS JUARA DUNIA TFN"}
                    </span>
                    <Trophy className="w-4 h-4 text-gold" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 items-center p-6 sm:p-10 gap-8">
                {/* Red Corner Fighter (5 cols) */}
                {(() => {
                  const redP =
                    mainFight.participants.find((p) => p.corner === "RED") ||
                    mainFight.participants[0];
                  const fighter = redP?.fighter;
                  const photo =
                    fighter?.portrait?.url || "/images/fighters/marcus-vale.jpg";

                  return (
                    <div className="md:col-span-5 text-center md:text-left space-y-4">
                      <div className="inline-block bg-fight-red text-white font-mono-data text-[10px] font-bold uppercase px-2.5 py-0.5 tracking-wider mb-1">
                        SUDUT MERAH / RED CORNER
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-5">
                        <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 bg-surface border-2 border-fight-red overflow-hidden shadow-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo}
                            alt={fighter ? `${fighter.firstName} ${fighter.lastName}` : "Red Fighter"}
                            className="w-full h-full object-cover object-top"
                          />
                        </div>

                        <div className="space-y-1">
                          {fighter?.ringName && (
                            <p className="font-mono-data text-xs text-fight-red font-bold uppercase tracking-widest">
                              "{fighter.ringName}"
                            </p>
                          )}
                          <h3 className="font-display text-2xl sm:text-3xl font-black uppercase text-ink leading-tight">
                            {fighter ? `${fighter.firstName} ${fighter.lastName}` : "TBA (To Be Announced)"}
                          </h3>

                          {fighter && (
                            <>
                              <p className="font-mono-data text-xs text-ink-muted">
                                Rekor:{" "}
                                <span className="font-bold text-ink">
                                  {fighter.wins}-{fighter.losses}-{fighter.draws} ({fighter.koWins} KO)
                                </span>
                              </p>
                              {fighter.hometown && (
                                <p className="font-mono-data text-[11px] text-ink-subtle">
                                  Asal: {fighter.hometown}
                                </p>
                              )}
                              <Link
                                href={`/fighters/${fighter.slug}`}
                                className="inline-flex items-center gap-1 font-mono-data text-xs text-fight-red font-bold uppercase hover:underline pt-1"
                              >
                                <span>Lihat Profil</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Center "VS" Graphic (2 cols) */}
                <div className="md:col-span-2 text-center py-4 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-surface border-2 border-subtle flex items-center justify-center shadow-lg mb-2">
                    <span className="font-display text-2xl font-black text-fight-red tracking-tight">
                      VS
                    </span>
                  </div>
                  <span className="font-mono-data text-[11px] font-bold uppercase text-ink-muted tracking-widest">
                    {mainFight.scheduledRounds} RONDE
                  </span>

                  {/* Fight Result if completed */}
                  {mainFight.status === "COMPLETED" && mainFight.result && (
                    <div className="mt-3 bg-canvas border border-subtle px-3 py-1.5 text-center">
                      <span className="font-mono-data text-[10px] text-emerald-400 font-bold uppercase block">
                        HASIL RESMI
                      </span>
                      <span className="font-display text-xs font-black text-ink uppercase">
                        {mainFight.result.method?.name || mainFight.result.outcome}
                        {mainFight.result.endRound ? ` (R${mainFight.result.endRound}${mainFight.result.endTime ? ` · ${mainFight.result.endTime}` : ""})` : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Blue Corner Fighter (5 cols) */}
                {(() => {
                  const blueP =
                    mainFight.participants.find((p) => p.corner === "BLUE") ||
                    mainFight.participants[1];
                  const fighter = blueP?.fighter;
                  const photo =
                    fighter?.portrait?.url || "/images/fighters/dario-storm.jpg";

                  return (
                    <div className="md:col-span-5 text-center md:text-right space-y-4">
                      <div className="inline-block bg-blue-600 text-white font-mono-data text-[10px] font-bold uppercase px-2.5 py-0.5 tracking-wider mb-1">
                        SUDUT BIRU / BLUE CORNER
                      </div>

                      <div className="flex flex-col sm:flex-row-reverse items-center gap-5">
                        <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 bg-surface border-2 border-blue-600 overflow-hidden shadow-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo}
                            alt={fighter ? `${fighter.firstName} ${fighter.lastName}` : "Blue Fighter"}
                            className="w-full h-full object-cover object-top"
                          />
                        </div>

                        <div className="space-y-1">
                          {fighter?.ringName && (
                            <p className="font-mono-data text-xs text-blue-400 font-bold uppercase tracking-widest">
                              "{fighter.ringName}"
                            </p>
                          )}
                          <h3 className="font-display text-2xl sm:text-3xl font-black uppercase text-ink leading-tight">
                            {fighter ? `${fighter.firstName} ${fighter.lastName}` : "TBA (To Be Announced)"}
                          </h3>

                          {fighter && (
                            <>
                              <p className="font-mono-data text-xs text-ink-muted">
                                Rekor:{" "}
                                <span className="font-bold text-ink">
                                  {fighter.wins}-{fighter.losses}-{fighter.draws} ({fighter.koWins} KO)
                                </span>
                              </p>
                              {fighter.hometown && (
                                <p className="font-mono-data text-[11px] text-ink-subtle">
                                  Asal: {fighter.hometown}
                                </p>
                              )}
                              <Link
                                href={`/fighters/${fighter.slug}`}
                                className="inline-flex items-center gap-1 font-mono-data text-xs text-blue-400 font-bold uppercase hover:underline pt-1"
                              >
                                <span>Lihat Profil</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </section>
        )}

        {/* Section: Full Fight Card (Daftar Seluruh Partai Laga) */}
        <section id="fight-card" className="space-y-6">
          <div className="border-b border-subtle pb-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="font-mono-data text-xs text-fight-red font-bold uppercase tracking-widest block mb-1">
                DAFTAR LENGKAP PARTAI LAGA
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black uppercase text-ink">
                SUSUNAN FIGHT CARD RESMI
              </h2>
            </div>
            <span className="font-mono-data text-xs text-ink-muted uppercase">
              TOTAL: {event.fights.length} PERTANDINGAN
            </span>
          </div>

          {event.fights.length === 0 ? (
            <div className="bg-charcoal border border-subtle p-12 text-center space-y-3">
              <Swords className="w-10 h-10 text-ink-subtle mx-auto" />
              <h3 className="font-display text-xl font-bold uppercase text-ink">
                SUSUNAN FIGHT CARD SEDANG DISIAPKAN
              </h3>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                Susunan resmi laga untuk event ini akan segera diumumkan oleh komisi pertandingan TFN.
                Silakan pantau kembali berkala.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {event.fights.map((fight, index) => {
                const redP =
                  fight.participants.find((p) => p.corner === "RED") || fight.participants[0];
                const blueP =
                  fight.participants.find((p) => p.corner === "BLUE") || fight.participants[1];
                const redFighter = redP?.fighter;
                const blueFighter = blueP?.fighter;

                return (
                  <div
                    key={fight.id}
                    className="bg-charcoal border border-subtle hover:border-fight-red/60 transition-colors p-5 sm:p-6 shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-subtle pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono-data text-xs font-black bg-surface px-2.5 py-1 text-ink">
                          BOUT #{fight.boutOrder || index + 1}
                        </span>
                        {fight.isMainEvent && (
                          <span className="bg-fight-red text-white font-mono-data text-[10px] font-bold uppercase px-2 py-0.5">
                            MAIN EVENT
                          </span>
                        )}
                        {fight.isTitleFight && (
                          <span className="bg-gold/20 text-gold border border-gold/40 font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            <span>TITLE FIGHT</span>
                          </span>
                        )}
                      </div>

                      <div className="font-mono-data text-xs text-ink-muted">
                        <span className="text-ink font-bold">
                          {fight.weightClass?.name || "Kelas Bebas"}
                        </span>{" "}
                        · {fight.scheduledRounds} Ronde
                      </div>
                    </div>

                    {/* Fight Matchup Row */}
                    <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
                      {/* Red Fighter */}
                      <div className="md:col-span-5 flex items-center gap-3">
                        <div className="w-12 h-12 shrink-0 bg-surface border border-fight-red overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={redFighter?.portrait?.url || "/images/fighters/marcus-vale.jpg"}
                            alt={redFighter ? `${redFighter.firstName} ${redFighter.lastName}` : "Red"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono-data font-bold text-fight-red uppercase block">
                            MERAH
                          </span>
                          <p className="font-display text-base font-black uppercase text-ink truncate">
                            {redFighter
                              ? `${redFighter.firstName} ${redFighter.lastName}`
                              : "TBA"}
                          </p>
                          {redFighter && (
                            <p className="text-[11px] font-mono-data text-ink-muted">
                              {redFighter.wins}-{redFighter.losses}-{redFighter.draws}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* VS Center */}
                      <div className="md:col-span-2 text-center py-2">
                        <span className="font-display text-sm font-black text-ink-subtle uppercase">
                          VS
                        </span>
                      </div>

                      {/* Blue Fighter */}
                      <div className="md:col-span-5 flex items-center justify-start md:justify-end gap-3 text-left md:text-right">
                        <div className="min-w-0 order-2 md:order-1">
                          <span className="text-[10px] font-mono-data font-bold text-blue-400 uppercase block">
                            BIRU
                          </span>
                          <p className="font-display text-base font-black uppercase text-ink truncate">
                            {blueFighter
                              ? `${blueFighter.firstName} ${blueFighter.lastName}`
                              : "TBA"}
                          </p>
                          {blueFighter && (
                            <p className="text-[11px] font-mono-data text-ink-muted">
                              {blueFighter.wins}-{blueFighter.losses}-{blueFighter.draws}
                            </p>
                          )}
                        </div>
                        <div className="w-12 h-12 shrink-0 bg-surface border border-blue-600 overflow-hidden order-1 md:order-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={blueFighter?.portrait?.url || "/images/fighters/dario-storm.jpg"}
                            alt={blueFighter ? `${blueFighter.firstName} ${blueFighter.lastName}` : "Blue"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Ticket Types & Pricing Table */}
        <section id="tickets" className="space-y-6">
          <div className="border-b border-subtle pb-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="font-mono-data text-xs text-fight-red font-bold uppercase tracking-widest block mb-1">
                KATEGORI & HARGA RESMI
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black uppercase text-ink">
                INFORMASI TIKET PENONTON
              </h2>
            </div>
            <Link
              href={ticketingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-display text-xs font-black uppercase text-fight-red hover:underline"
            >
              <span>BUKA SISTEM TIKET TFN</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          {event.ticketTypes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {event.ticketTypes.map((tt) => (
                <div
                  key={tt.id}
                  className="bg-charcoal border border-subtle p-6 flex flex-col justify-between space-y-4 hover:border-fight-red transition-colors shadow-lg"
                >
                  <div className="space-y-2">
                    <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-wider block">
                      KATEGORI TIKET
                    </span>
                    <h3 className="font-display text-xl font-black uppercase text-ink">
                      {tt.name}
                    </h3>
                    <p className="font-display text-2xl font-black text-ink">
                      Rp{Number(tt.price).toLocaleString("id-ID")}
                    </p>
                    {tt.description && (
                      <p className="text-xs text-ink-muted leading-relaxed pt-2">
                        {tt.description}
                      </p>
                    )}
                  </div>

                  <Link
                    href={ticketingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-fight-red hover:bg-fight-red-hover text-white font-display text-xs font-black uppercase tracking-wider py-2.5 transition-colors"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>PESAN KATEGORI INI</span>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-charcoal border border-subtle p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="space-y-2 text-center sm:text-left">
                <h3 className="font-display text-xl font-black uppercase text-ink">
                  TIKET DAPAT DIPESAN MELALUI PORTAL RESMI
                </h3>
                <p className="text-xs text-ink-muted max-w-xl">
                  Pemesanan tiket online resmi Temanggung Fight Night dikelola terpusat melalui portal tiket.pimpom.id dengan metode pembayaran QRIS, Transfer Bank, dan konfirmasi otomatis.
                </p>
              </div>
              <Link
                href={ticketingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-2 bg-fight-red hover:bg-fight-red-hover text-white font-display text-xs font-black uppercase tracking-wider px-6 py-3 shadow-md"
              >
                <Ticket className="w-4 h-4" />
                <span>PILIH TIKET DI TIKET.PIMPOM.ID</span>
              </Link>
            </div>
          )}
        </section>

        {/* Back navigation & Footer link */}
        <div className="pt-8 border-t border-subtle flex items-center justify-between flex-wrap gap-4">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 font-mono-data text-xs text-ink-muted hover:text-fight-red transition-colors uppercase font-bold"
          >
            <span>← KEMBALI KE SEMUA JADWAL EVENT</span>
          </Link>

          <Link
            href="/"
            className="font-mono-data text-xs text-ink-muted hover:text-ink transition-colors uppercase"
          >
            TEMANGGUNG FIGHT NIGHT CHAMPIONSHIP
          </Link>
        </div>
      </div>
    </div>
  );
}
