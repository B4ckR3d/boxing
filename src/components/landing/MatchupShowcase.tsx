"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function MatchupShowcase() {
  const { lang } = useLanguage();
  return (
    <section className="border-b border-subtle bg-canvas py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-8">
        <div><p className="font-mono-data text-xs font-bold uppercase tracking-widest text-fight-red">{lang === "id" ? "DI DALAM ARENA TFN" : "INSIDE THE TFN ARENA"}</p><h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">{lang === "id" ? "SETIAP RONDE PUNYA CERITA." : "EVERY ROUND HAS A STORY."}</h2><p className="mt-5 max-w-lg text-sm leading-7 text-ink-muted">{lang === "id" ? "Dari persiapan di sasana hingga langkah pertama menuju ring. Kenali petarung dan ikuti informasi kompetisi melalui halaman acara TFN." : "From gym preparation to that first step into the ring. Discover the fighters and follow competition information on the TFN events page."}</p><div className="mt-7 flex flex-wrap gap-4"><Link href="/fighters" className="inline-flex min-h-12 items-center gap-4 border border-subtle px-5 text-sm font-bold hover:border-fight-red">{lang === "id" ? "Kenali petarung" : "Meet the fighters"}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link><Link href="/tickets" className="inline-flex min-h-12 items-center gap-4 bg-fight-red px-5 text-sm font-bold text-white hover:bg-fight-red-hover">{lang === "id" ? "Cari tiket" : "Find tickets"}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div></div>
        <figure className="relative border border-subtle bg-charcoal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero/boxing-ring-arena.jpg" width={960} height={640} loading="lazy" alt={lang === "id" ? "Ilustrasi ring tinju di bawah sorotan lampu arena" : "Illustration of a boxing ring under arena lights"} className="aspect-[4/3] w-full object-cover" /><figcaption className="border-t border-subtle px-5 py-4 font-mono-data text-[11px] uppercase tracking-wider text-ink-muted">{lang === "id" ? "VISUAL DEMO / ILUSTRASI SUASANA ARENA" : "DEMO VISUAL / ILLUSTRATIVE ARENA ATMOSPHERE"}</figcaption>
        </figure>
      </div>
    </section>
  );
}
