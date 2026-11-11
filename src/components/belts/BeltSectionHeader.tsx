"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function BeltSectionHeader() {
  const { t } = useLanguage();

  return (
    <div className="mb-10 text-center">
      <span className="font-mono-data text-xs text-fight-red font-bold tracking-widest uppercase">
        {t("beltEyebrow")}
      </span>
      <h2 className="font-display text-4xl sm:text-6xl text-ink tracking-tight uppercase font-black mt-1">
        {t("beltTitleMain")} <span className="text-fight-red">{t("beltTitleHighlight")}</span>
      </h2>
      <p className="font-sans text-xs sm:text-sm text-ink-muted mt-2 max-w-xl mx-auto">
        {t("beltDescription")}
      </p>
    </div>
  );
}
