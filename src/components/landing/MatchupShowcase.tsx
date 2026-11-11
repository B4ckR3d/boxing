"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function MatchupShowcase() {
  const { t, lang } = useLanguage();

  const [timeLeft, setTimeLeft] = useState({
    days: 12,
    hours: 22,
    minutes: 36,
    seconds: 45,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const matchups = [
    {
      id: "bout-1",
      fighterA: {
        name: "MARCUS VALE",
        record: "28-0-0",
        country: "USA",
        image: "/images/fighters/marcus-vale.jpg",
      },
      fighterB: {
        name: "TOMAS REYES",
        record: "24-2-0",
        country: "MEX",
        image: "/images/fighters/tomas-reyes.jpg",
      },
      title: lang === "id" ? "GELAR JUARA DUNIA KELAS BERAT TFN" : "TFN WORLD HEAVYWEIGHT CHAMPIONSHIP",
      date: lang === "id" ? "24 DESEMBER 2026" : "DECEMBER 24, 2026",
      venue: "GEDUNG PEMUDA TEMANGGUNG · JAWA TENGAH",
    },
    {
      id: "bout-2",
      fighterA: {
        name: "DARIO STORM",
        record: "25-1-0",
        country: "GBR",
        image: "/images/fighters/dario-storm.jpg",
      },
      fighterB: {
        name: "KENJI ARATA",
        record: "22-1-0",
        country: "JPN",
        image: "/images/fighters/kenji-arata.jpg",
      },
      title: lang === "id" ? "SEMIFINAL TFN WORLD GRAND PRIX" : "TFN WORLD GRAND PRIX SEMI-FINAL",
      date: lang === "id" ? "24 DESEMBER 2026" : "DECEMBER 24, 2026",
      venue: "STADION BHUMI PHALA · TEMANGGUNG",
    },
  ];

  return (
    <section className="py-16 bg-canvas border-b border-subtle transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Matchup Header */}
        <div className="text-center max-w-xl mx-auto">
          <span className="font-mono-data text-xs text-fight-red font-bold tracking-widest uppercase">
            {t("matchupEyebrow")}
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-ink uppercase tracking-tight mt-1 font-black">
            {t("matchupTitle")}
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted mt-2 font-sans">
            {t("matchupSubtitle")}
          </p>
        </div>

        {/* 1. VS Matchup Cards (From Reference Image 3) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {matchups.map((m) => (
            <div
              key={m.id}
              className="bg-charcoal text-ink p-6 sm:p-8 flex flex-col justify-between shadow-lg relative border-t-4 border-fight-red"
            >
              {/* Category Pill */}
              <div className="text-center mb-6">
                <span className="inline-block bg-canvas text-ink font-mono-data text-[10px] font-bold uppercase tracking-widest px-3 py-1">
                  {m.title}
                </span>
              </div>

              {/* Head-to-Head Cutout Photos & Central "VS" */}
              <div className="flex items-center justify-around gap-4 my-2">
                {/* Fighter A */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-subtle bg-surface-elevated shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.fighterA.image}
                      alt={m.fighterA.name}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <span className="font-mono-data text-[11px] font-bold text-ink-subtle mt-2">
                    {m.fighterA.country} · {m.fighterA.record}
                  </span>
                </div>

                {/* Central "VS" Badge */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-fight-red text-ink flex items-center justify-center font-display text-base font-black shadow-md">
                    VS
                  </div>
                </div>

                {/* Fighter B */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-subtle bg-surface-elevated shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.fighterB.image}
                      alt={m.fighterB.name}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <span className="font-mono-data text-[11px] font-bold text-ink-subtle mt-2">
                    {m.fighterB.country} · {m.fighterB.record}
                  </span>
                </div>
              </div>

              {/* Title Names */}
              <div className="text-center mt-6">
                <h3 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-ink">
                  {m.fighterA.name} <span className="text-fight-red">VS</span> {m.fighterB.name}
                </h3>
                <div className="flex items-center justify-center gap-3 font-mono-data text-xs text-ink-subtle mt-1">
                  <span>{m.date}</span>
                  <span>•</span>
                  <span>{m.venue}</span>
                </div>
              </div>

              {/* Dual Action Buttons (Image 3 style: DETAIL + TICKETS) */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-subtle">
                <Link href="/fights">
                  <Button variant="dark" size="sm" className="w-full font-bold">
                    {t("matchupBtnDetail")}
                  </Button>
                </Link>
                <Link href="/events">
                  <Button variant="crimson" size="sm" className="w-full font-bold">
                    {t("matchupBtnTickets")}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* 2. Fight Night Live Countdown Banner (From Reference Image 3) */}
        <div className="relative overflow-hidden bg-gradient-to-r from-fight-red/40 via-charcoal to-surface-elevated p-8 sm:p-12 border border-subtle text-ink">
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Fighter Left */}
            <div className="flex items-center gap-4 text-left">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-hard/50 bg-canvas/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/fighters/marcus-vale.jpg"
                  alt="Marcus Vale"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div>
                <span className="font-mono-data text-[10px] text-red-300 font-bold tracking-widest uppercase">
                  {t("worldChampion")}
                </span>
                <p className="font-display text-2xl sm:text-3xl font-black">MARCUS VALE</p>
                <span className="font-mono-data text-xs text-ink-muted">USA · 28-0 (24 KOs)</span>
              </div>
            </div>

            {/* Center Countdown Unit */}
            <div className="text-center space-y-4">
              <div className="inline-block px-3 py-1 bg-charcoal text-ink font-display text-xs font-black tracking-widest uppercase">
                {t("countdownBadge")}
              </div>

              <div className="flex items-center justify-center gap-3 sm:gap-4 font-mono-data">
                <div className="bg-canvas/70 border border-hard/20 px-3 py-2 min-w-[60px] text-center">
                  <span className="font-display text-3xl sm:text-4xl font-black block text-ink">
                    {String(timeLeft.days).padStart(2, "0")}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-ink-muted font-bold">{t("days")}</span>
                </div>
                <div className="bg-canvas/70 border border-hard/20 px-3 py-2 min-w-[60px] text-center">
                  <span className="font-display text-3xl sm:text-4xl font-black block text-ink">
                    {String(timeLeft.hours).padStart(2, "0")}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-ink-muted font-bold">{t("hours")}</span>
                </div>
                <div className="bg-canvas/70 border border-hard/20 px-3 py-2 min-w-[60px] text-center">
                  <span className="font-display text-3xl sm:text-4xl font-black block text-ink">
                    {String(timeLeft.minutes).padStart(2, "0")}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-ink-muted font-bold">{t("minutes")}</span>
                </div>
                <div className="bg-canvas/70 border border-hard/20 px-3 py-2 min-w-[60px] text-center">
                  <span className="font-display text-3xl sm:text-4xl font-black block text-fight-red">
                    {String(timeLeft.seconds).padStart(2, "0")}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-ink-muted font-bold">{t("seconds")}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <Link href="/fights">
                  <Button variant="dark" size="sm" className="font-bold">
                    {t("matchupBtnDetail")}
                  </Button>
                </Link>
                <Link href="/events">
                  <Button variant="crimson" size="sm" className="font-bold">
                    {t("matchupBtnTickets")}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Fighter Right */}
            <div className="flex items-center gap-4 text-right flex-row-reverse lg:flex-row">
              <div className="text-right">
                <span className="font-mono-data text-[10px] text-blue-300 font-bold tracking-widest uppercase">
                  {t("topContender")}
                </span>
                <p className="font-display text-2xl sm:text-3xl font-black">TOMAS REYES</p>
                <span className="font-mono-data text-xs text-ink-muted">MEX · 24-2 (19 KOs)</span>
              </div>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-hard/50 bg-canvas/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/fighters/tomas-reyes.jpg"
                  alt="Tomas Reyes"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
