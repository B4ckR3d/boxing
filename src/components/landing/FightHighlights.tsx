"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function FightHighlights() {
  const { t } = useLanguage();

  const highlights = [
    {
      id: "hl-1",
      tag: t("highlightsBadge"),
      title: t("hl1Title"),
      description: t("hl1Desc"),
      image: "/images/hero/boxing-ring-arena.jpg",
      href: "/fights",
    },
    {
      id: "hl-2",
      tag: t("highlightsBadge"),
      title: t("hl2Title"),
      description: t("hl2Desc"),
      image: "/images/fighters/dario-storm.jpg",
      href: "/grand-prix",
    },
    {
      id: "hl-3",
      tag: t("highlightsBadge"),
      title: t("hl3Title"),
      description: t("hl3Desc"),
      image: "/images/fighters/kenji-arata.jpg",
      href: "/events",
    },
  ];

  return (
    <section className="py-12 bg-charcoal text-ink border-b border-subtle transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {highlights.map((h) => (
            <Link
              key={h.id}
              href={h.href}
              className="group border border-subtle p-4 sm:p-5 flex items-center justify-between gap-4 hover:border-ink transition-all bg-neutral-50 hover:bg-charcoal"
            >
              <div className="space-y-2 flex-1">
                <span className="inline-block bg-fight-red text-ink font-mono-data text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                  {h.tag}
                </span>
                <h4 className="font-display text-base sm:text-lg font-black uppercase tracking-tight text-ink group-hover:text-fight-red transition-colors line-clamp-2">
                  {h.title}
                </h4>
                <p className="text-xs text-ink-subtle line-clamp-2 font-sans">
                  {h.description}
                </p>
                <div className="inline-flex items-center gap-1 text-xs font-bold text-fight-red pt-1">
                  <span>{t("moreLink")}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 overflow-hidden bg-surface-elevated">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.image}
                  alt={h.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
