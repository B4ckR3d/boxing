"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function BeltSectionHeader() {
  const { t } = useLanguage();

  return (
    <div className="mb-10 text-center">
      <h2 className="font-display text-4xl sm:text-6xl text-ink tracking-tight uppercase font-black">
        {t("beltTitleMain")} <span className="text-fight-red">{t("beltTitleHighlight")}</span>
      </h2>
    </div>
  );
}
