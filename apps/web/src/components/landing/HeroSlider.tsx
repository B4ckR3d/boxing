"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Ticket } from "lucide-react";
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
  isDemo?: boolean;
  overlay: "DARK" | "GOLD" | "CRIMSON";
}

export interface HeroSliderProps { slides: HeroSlideData[]; autoplayIntervalMs?: number }

export function HeroSlider({ slides, autoplayIntervalMs = 7000 }: HeroSliderProps) {
  const { lang } = useLanguage();
  const [currentIdx, setCurrentIdx] = useState(0);
  // Opt-in motion keeps reading and keyboard navigation predictable.
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const touchStart = useRef<number | null>(null);
  const next = useCallback(() => setCurrentIdx((index) => (index + 1) % Math.max(slides.length, 1)), [slides.length]);
  const previous = () => setCurrentIdx((index) => (index - 1 + slides.length) % Math.max(slides.length, 1));

  useEffect(() => {
    if (!isPlaying || isInteracting || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(next, autoplayIntervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, isInteracting, slides.length, next, autoplayIntervalMs]);

  const slide = slides[currentIdx % Math.max(slides.length, 1)];
  if (!slide) return <section className="bg-canvas px-4 py-24"><h1 className="font-display text-5xl">Temanggung Fight Night</h1><Link href="/tickets" className="mt-6 inline-flex min-h-12 items-center bg-fight-red px-6 font-bold text-white">{lang === "id" ? "Lihat tiket" : "View tickets"}</Link></section>;

  return (
    <section className="tfn-hero relative isolate overflow-hidden bg-[#0b0b0d] text-white" aria-roledescription="carousel" aria-label="Temanggung Fight Night" onMouseEnter={() => setIsInteracting(true)} onMouseLeave={() => setIsInteracting(false)} onFocusCapture={() => setIsInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false); }} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchStart.current !== null && end !== undefined && Math.abs(touchStart.current - end) > 60) { setIsPlaying(false); if (touchStart.current > end) next(); else previous(); } touchStart.current = null; }}>
      <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${slide.backgroundImageUrl || "/images/hero/boxing-ring-arena.jpg"})` }} />
      <div aria-hidden="true" className="tfn-hero-portrait absolute inset-y-0 right-0 w-full lg:w-[58%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.fighterImageUrl || "/images/hero/hero_fighter_1_marcus.jpg"} alt="" fetchPriority="high" className="h-full w-full object-cover object-top" />
      </div>
      <div aria-hidden="true" className="tfn-hero-scrim absolute inset-0" />
      <div className="relative mx-auto flex min-h-[660px] max-w-7xl flex-col justify-center px-4 pb-28 pt-16 sm:px-6 sm:pt-20 lg:min-h-[740px] lg:px-8">
        <div className="max-w-xl lg:max-w-[58%]" aria-live={isPlaying ? "off" : "polite"} aria-atomic="true">
          <p className="mb-5 font-mono-data text-xs font-bold uppercase tracking-[0.18em] text-[#f5c542]">{slide.isDemo ? (lang === "id" ? "PRATINJAU TFN / KONTEN DEMO" : "TFN PREVIEW / DEMO CONTENT") : slide.category || "TEMANGGUNG FIGHT NIGHT"}</p>
          <p className="mb-4 font-mono-data text-xs uppercase tracking-wider text-neutral-300">{slide.eventTitle}</p>
          <h1 className="font-display text-[clamp(2.75rem,7vw,6rem)] font-bold uppercase leading-[1.03] tracking-tight [text-wrap:balance]">{slide.headline}</h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-neutral-300 sm:text-base">{slide.description}</p>
          {slide.eventDate && !slide.isDemo && <p className="mt-4 font-mono-data text-sm text-[#f5c542]">{new Date(slide.eventDate).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</p>}
          <div className="mt-8 flex flex-col gap-3 min-[400px]:flex-row">
            <Link href="/tickets" className="inline-flex min-h-13 items-center justify-center gap-3 bg-fight-red px-7 text-sm font-bold uppercase tracking-wider text-white hover:bg-fight-red-hover"><Ticket className="h-4 w-4" aria-hidden="true" />{lang === "id" ? "Jelajahi tiket" : "Explore tickets"}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
            <Link href={slide.ctaSecondaryHref || "/events"} className="inline-flex min-h-13 items-center justify-center border border-white/40 bg-black/30 px-6 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10">{slide.ctaSecondaryLabel || (lang === "id" ? "Lihat agenda" : "View events")}</Link>
          </div>
          {slide.isDemo && <p className="mt-4 max-w-md text-xs leading-5 text-neutral-400">{lang === "id" ? "Visual dan petarung ilustratif. Bukan pengumuman jadwal, gelar, atau ketersediaan tiket." : "Illustrative visuals and fighters. Not an announcement of dates, titles, or ticket availability."}</p>}
        </div>
        {slides.length > 1 && <div className="absolute inset-x-4 bottom-6 flex items-center justify-between gap-4 border-t border-white/20 pt-5 sm:inset-x-6 lg:inset-x-8">
          <div className="flex gap-2">{slides.map((item, index) => <button key={item.id} type="button" aria-label={`${lang === "id" ? "Tampilkan slide" : "Show slide"} ${index + 1}`} aria-current={currentIdx === index ? "true" : undefined} onClick={() => { setCurrentIdx(index); setIsPlaying(false); }} className="flex h-11 w-7 items-center justify-center sm:w-10"><span className={`h-1 w-full ${currentIdx === index ? "bg-[#f5c542]" : "bg-white/30"}`} /></button>)}</div>
          <div className="flex items-center gap-2"><span className="mr-1 hidden font-mono-data text-xs text-neutral-300 sm:block">{String(currentIdx + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span><button type="button" aria-label={isPlaying ? "Pause slides" : "Play slides"} aria-pressed={isPlaying} onClick={() => setIsPlaying(!isPlaying)} className="flex h-11 w-11 items-center justify-center border border-white/30 hover:bg-white/10">{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button><button type="button" aria-label={lang === "id" ? "Slide sebelumnya" : "Previous slide"} onClick={() => { previous(); setIsPlaying(false); }} className="flex h-11 w-11 items-center justify-center border border-white/30 hover:bg-white/10"><ChevronLeft /></button><button type="button" aria-label={lang === "id" ? "Slide berikutnya" : "Next slide"} onClick={() => { next(); setIsPlaying(false); }} className="flex h-11 w-11 items-center justify-center bg-white text-black hover:bg-[#f5c542]"><ChevronRight /></button></div>
        </div>}
      </div>
    </section>
  );
}
