"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function FightHighlights() {
  const { lang } = useLanguage();
  const items = [
    { href: "/events", label: lang === "id" ? "Agenda arena" : "Arena calendar", description: lang === "id" ? "Temukan informasi acara yang telah diterbitkan." : "Find published event information." },
    { href: "/fighters", label: lang === "id" ? "Di balik sarung tinju" : "Behind the gloves", description: lang === "id" ? "Kenali profil dan perjalanan para petarung." : "Discover fighter profiles and their journeys." },
    { href: "/rankings", label: lang === "id" ? "Peta persaingan" : "The competition", description: lang === "id" ? "Jelajahi peringkat dan divisi kompetisi." : "Explore rankings and competition divisions." },
  ];
  return <section aria-label={lang === "id" ? "Jelajahi TFN" : "Explore TFN"} className="border-b border-subtle bg-charcoal"><div className="mx-auto grid max-w-7xl divide-y divide-border-subtle px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">{items.map((item, index) => <Link key={item.href} href={item.href} className="group flex min-w-0 items-start gap-4 py-8 md:px-6 md:first:pl-0 md:last:pr-0"><span className="mt-1 font-mono-data text-xs text-fight-red">0{index + 1}</span><div className="flex-1"><h2 className="font-display text-xl font-bold group-hover:text-fight-red">{item.label}</h2><p className="mt-2 text-xs leading-6 text-ink-muted">{item.description}</p></div><ArrowUpRight className="h-5 w-5 shrink-0 text-ink-muted group-hover:text-fight-red" aria-hidden="true" /></Link>)}</div></section>;
}
