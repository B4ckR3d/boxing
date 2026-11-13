"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function Footer() {
  const { t, lang } = useLanguage();
  const links = [{ href: "/events", label: t("navEvents") }, { href: "/fighters", label: t("navAthletes") }, { href: "/rankings", label: t("navRankings") }, { href: "/grand-prix", label: t("navGrandPrix") }, { href: "/belts", label: t("navBelts") }, { href: "/fights", label: t("navFightHistory") }];
  return (
    <footer className="border-t border-subtle bg-charcoal text-ink">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div><Link href="/" aria-label="TFN — Temanggung Fight Night" className="font-display text-5xl font-black italic">TFN<span className="text-fight-red">.</span></Link><p className="mt-4 font-display text-lg tracking-wide">TEMANGGUNG FIGHT NIGHT</p><p className="mt-3 max-w-sm text-sm leading-7 text-ink-muted">{lang === "id" ? "Ruang untuk mengenal petarung, mengikuti perjalanan kompetisi, dan menemukan pengalaman fight night di Temanggung." : "Discover the fighters, follow the competition, and find your fight night experience in Temanggung."}</p></div>
          <nav aria-label="Footer"><h2 className="mb-3 font-mono-data text-xs uppercase tracking-widest text-ink-muted">{t("footerNavTitle")}</h2><ul className="grid grid-cols-2 gap-x-4">{links.map((link) => <li key={link.href}><Link href={link.href} className="inline-flex min-h-11 items-center text-sm hover:text-fight-red">{link.label}</Link></li>)}</ul></nav>
          <div><h2 className="font-display text-2xl">{lang === "id" ? "Sampai jumpa di arena." : "See you ringside."}</h2><p className="mt-3 text-sm leading-6 text-ink-muted">{lang === "id" ? "Periksa acara dan pilihan tiket yang tersedia sebelum memesan." : "Check available events and ticket options before booking."}</p><Link href="/tickets" className="mt-5 inline-flex min-h-12 items-center gap-4 border border-fight-red px-5 text-sm font-bold hover:bg-fight-red hover:text-white">{lang === "id" ? "Jelajahi tiket" : "Explore tickets"}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-subtle pt-6 text-xs leading-6 text-ink-muted sm:flex-row"><p>TFN / TEMANGGUNG FIGHT NIGHT</p><p className="max-w-xl">{lang === "id" ? "Materi bertanda demo merupakan ilustrasi, bukan pengumuman acara atau klaim gelar resmi." : "Content marked as demo is illustrative, not an event announcement or an official title claim."}</p></div>
      </div>
    </footer>
  );
}
