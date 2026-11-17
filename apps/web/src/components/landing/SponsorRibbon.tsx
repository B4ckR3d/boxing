"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Do not imply endorsements or sanctioning without published sponsor records.
export function SponsorRibbon() {
  const { lang } = useLanguage();
  return <aside className="border-y border-subtle bg-charcoal"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 py-6 sm:flex-row sm:items-center sm:px-6 lg:px-8"><p className="font-display text-xl tracking-wide">TEMANGGUNG <span className="text-fight-red">/</span> FIGHT NIGHT</p><p className="text-xs leading-6 text-ink-muted">{lang === "id" ? "Petarung. Kompetisi. Cerita di balik ring." : "Fighters. Competition. Stories beyond the ring."}</p><Link href="/events" className="inline-flex min-h-11 items-center gap-3 text-xs font-bold uppercase tracking-wider hover:text-fight-red">{lang === "id" ? "Jelajahi agenda" : "Explore events"}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div></aside>;
}
