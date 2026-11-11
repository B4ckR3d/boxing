"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Flame } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface HeroSlideData {
  id: string;
  eventTitle: string;
  category?: string | null;
  headline: string;
  description?: string | null;
  eventDate?: string | Date | null;
  backgroundImageUrl?: string | null;
  fighterImageUrl?: string | null;
  fighterName?: string | null;
  ctaPrimaryLabel?: string | null;
  ctaPrimaryHref?: string | null;
  ctaSecondaryLabel?: string | null;
  ctaSecondaryHref?: string | null;
  show3dBelt?: boolean;
  overlay: "DARK" | "GOLD" | "CRIMSON";
}

export interface HeroSliderProps {
  slides: HeroSlideData[];
  autoplayIntervalMs?: number;
}

export function HeroSlider({ slides, autoplayIntervalMs = 7000 }: HeroSliderProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { t, lang } = useLanguage();

  const nextSlide = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % (slides.length || 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIdx((prev) => (prev - 1 + slides.length) % (slides.length || 1));
  }, [slides.length]);

  useEffect(() => {
    if (isPlaying && slides.length > 1) {
      timerRef.current = setInterval(nextSlide, autoplayIntervalMs);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, nextSlide, autoplayIntervalMs, slides.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0]?.clientX ?? 0;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
  };

  if (!slides || slides.length === 0) {
    return (
      <section className="relative min-h-[500px] flex items-center justify-center bg-canvas">
        <div className="text-center p-8">
          <p className="font-display text-4xl text-foreground font-black">
            TEMANGGUNG FIGHT NIGHT (TFN)
          </p>
          <p className="font-mono-data text-sm text-muted-foreground mt-2">
            Tidak ada jadwal slide aktif
          </p>
        </div>
      </section>
    );
  }

  const slide = slides[currentIdx]!;
  const fighterImg = slide.fighterImageUrl || "/images/hero/hero_fighter_1_marcus.jpg";

  return (
    <section
      className="relative min-h-[660px] sm:min-h-[740px] lg:min-h-[820px] flex items-center bg-[#0B0B0D] overflow-hidden select-none transition-colors"
      onMouseEnter={() => setIsPlaying(false)}
      onMouseLeave={() => setIsPlaying(true)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      aria-label="Temanggung Fight Night Hero Slider"
    >
      {/* 1. Background Arena Atmosphere with Texture & Radial Light */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 opacity-35 scale-105"
        style={{
          backgroundImage: `url(${slide.backgroundImageUrl || "/images/hero/boxing-ring-arena.jpg"})`,
        }}
      />

      {/* Radial Spotlights (Red & Golden Combat Haze) */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-fight-red/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-[#F5C542]/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Scrim Gradient Masks (Preserving text contrast on left, blending fighter on right) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B0D] via-[#0B0B0D]/80 to-transparent z-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-transparent to-[#0B0B0D]/40 z-0" />

      {/* 2. PROMINENT HERO FIGHTER PHOTO (From User Uploaded References) */}
      <div className="absolute right-0 bottom-0 w-full lg:w-[54%] h-[68%] lg:h-[94%] z-10 pointer-events-none flex items-end justify-center lg:justify-end overflow-hidden">
        <div className="relative w-full h-full max-w-2xl flex items-end justify-center lg:justify-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={slide.id || currentIdx}
            src={fighterImg}
            alt={slide.headline}
            className="w-full h-full object-contain object-bottom drop-shadow-[0_20px_50px_rgba(229,9,20,0.45)] transition-all duration-700 transform scale-100 animate-in fade-in zoom-in-95"
          />

          {/* Bottom Gradient Fade to merge seamlessly with canvas */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0B0B0D] to-transparent pointer-events-none" />
          {/* Left Gradient Fade on desktop */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0B0B0D] to-transparent hidden lg:block pointer-events-none" />
        </div>
      </div>

      {/* 3. Main Text Content Stage (Left Half) */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full z-20">
        <div className="max-w-xl sm:max-w-2xl lg:max-w-2xl">
          {/* Red Date / Category Pill */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-fight-red text-white font-mono-data text-xs font-bold uppercase tracking-wider shadow-lg">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {slide.eventDate
                  ? new Date(slide.eventDate).toLocaleDateString(
                      lang === "id" ? "id-ID" : "en-US",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }
                    )
                  : t("heroDatePill")}
              </span>
            </div>

            {slide.category && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/60 backdrop-blur border border-neutral-700 text-[#F5C542] font-mono-data text-[11px] font-bold uppercase tracking-wider">
                <Flame className="w-3 h-3 text-fight-red" />
                {slide.category}
              </span>
            )}
          </div>

          {/* Subtitle / Venue Pill */}
          <p className="font-mono-data text-xs sm:text-sm font-bold tracking-[0.2em] text-neutral-400 uppercase mb-2">
            {slide.eventTitle || "TFN 01 · GEDUNG PEMUDA TEMANGGUNG"}
          </p>

          {/* Giant Display Headline (Oswald Condensed Bold) */}
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-white leading-[0.92] uppercase font-black drop-shadow-md">
            {slide.headline}
          </h1>

          {/* Short Punchy Description */}
          <p className="text-sm sm:text-base text-neutral-300 mt-5 max-w-xl font-sans leading-relaxed drop-shadow">
            {slide.description || t("heroDescription")}
          </p>

          {/* Action CTA Buttons (Image 2 style) */}
          <div className="flex flex-wrap items-center gap-4 mt-8">
            <Link href={slide.ctaPrimaryHref || "/events"}>
              <Button
                variant="crimson"
                size="lg"
                className="font-bold tracking-wider px-8 h-12 text-sm uppercase shadow-lg shadow-fight-red/30 hover:scale-105 transition-transform"
              >
                {slide.ctaPrimaryLabel || t("heroCtaPrimary")}
              </Button>
            </Link>

            <Link href={slide.ctaSecondaryHref || "/rankings"}>
              <Button
                variant="outline"
                size="lg"
                className="font-bold tracking-wider px-7 h-12 text-sm uppercase bg-black/50 backdrop-blur border-neutral-600 text-white hover:bg-neutral-800 hover:border-white transition-colors"
              >
                {slide.ctaSecondaryLabel || t("heroCtaSecondary")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Bottom Bar: 5-Fighter Thumbnail Carousel (Left) + Nav Controls (Right) */}
      <div className="absolute bottom-6 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-end justify-between gap-4">
          {/* Thumbnail Carousel Cards (Bottom Left) — Showing all 5 slides! */}
          <div className="hidden sm:flex items-center gap-2.5 max-w-2xl overflow-x-auto pb-1 scrollbar-none">
            {slides.map((s, idx) => {
              const thumbImg = s.fighterImageUrl || s.backgroundImageUrl || "/images/hero/boxing-ring-arena.jpg";
              const isActive = currentIdx === idx;

              return (
                <button
                  key={s.id || idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`flex items-center gap-2.5 p-2 text-left transition-all backdrop-blur-md cursor-pointer ${
                    isActive
                      ? "border-2 border-fight-red bg-black/90 shadow-lg shadow-fight-red/20 scale-105"
                      : "border border-neutral-800 bg-black/60 opacity-60 hover:opacity-100 hover:border-neutral-600"
                  }`}
                  style={{ width: "200px" }}
                >
                  <div
                    className="w-11 h-11 bg-cover bg-top shrink-0 border border-neutral-700 overflow-hidden"
                    style={{
                      backgroundImage: `url(${thumbImg})`,
                    }}
                  />
                  <div className="overflow-hidden leading-tight">
                    <p className={`font-display text-xs uppercase truncate font-black ${isActive ? "text-fight-red" : "text-white"}`}>
                      {s.fighterName || s.headline}
                    </p>
                    <p className="font-mono-data text-[9px] text-neutral-400 truncate mt-0.5 uppercase">
                      {s.category || s.eventTitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Prev/Next Arrow Navigation Buttons (Bottom Right, Image 2 style: White square buttons) */}
          <div className="flex items-center gap-3">
            {/* Slide Index Counter */}
            <span className="font-mono-data text-xs text-neutral-400 font-bold tracking-wider">
              <span className="text-white">0{currentIdx + 1}</span> / 0{slides.length}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={prevSlide}
                className="w-10 h-10 sm:w-11 sm:h-11 bg-white text-black hover:bg-fight-red hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-md"
                aria-label="Slide sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextSlide}
                className="w-10 h-10 sm:w-11 sm:h-11 bg-white text-black hover:bg-fight-red hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-md"
                aria-label="Slide berikutnya"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
