"use client";

import React from "react";
import { Shield, Award, Flame, Swords, Crosshair, Zap } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function SponsorRibbon() {
  const { t } = useLanguage();

  const sponsors = [
    { name: "TEMANGGUNG FIGHT CLUB", icon: Shield, subtitle: t("sponsorSanctioned") },
    { name: "GLOVE LEAGUE", icon: Swords, subtitle: t("sponsorOfficialGear") },
    { name: "BHUMI PHALA COMBAT", icon: Flame, subtitle: t("sponsorPerformance") },
    { name: "APEX STRIKE", icon: Crosshair, subtitle: t("sponsorTelemetry") },
    { name: "CHAMPIONSHIP SERIES", icon: Award, subtitle: t("sponsorGlobalTour") },
    { name: "OCTANE NUTRITION", icon: Zap, subtitle: t("sponsorHydration") },
  ];

  return (
    <div className="bg-charcoal border-y border-subtle py-6 px-4 select-none transition-colors">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-around gap-6 md:gap-12 opacity-80 hover:opacity-100 transition-opacity">
        {sponsors.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className="flex items-center gap-2.5 text-ink-muted hover:text-ink transition-colors">
              <Icon className="w-5 h-5 text-ink-muted" />
              <div>
                <span className="font-display text-sm tracking-wider uppercase block text-ink font-bold leading-none">
                  {s.name}
                </span>
                <span className="font-mono-data text-[9px] text-fight-red tracking-widest block uppercase font-bold mt-0.5">
                  {s.subtitle}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
