"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-canvas border-t border-subtle text-ink select-none transition-colors">
      {/* Main Footer Directory */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center tracking-tighter">
              <span className="font-display italic text-3xl sm:text-4xl text-ink font-black">
                TFN
              </span>
              <span className="font-display italic text-2xl sm:text-3xl text-fight-red font-black ml-0.5">
                ·X
              </span>
              <span className="ml-2 font-mono-data text-[10px] bg-fight-red text-ink font-bold px-1.5 py-0.5 uppercase tracking-wider">
                TEMANGGUNG FIGHT NIGHT
              </span>
            </div>

            <p className="text-xs sm:text-sm text-ink-muted max-w-md leading-relaxed font-sans">
              {t("footerDescription")}
            </p>

            {/* Social Icons Row */}
            <div className="flex items-center gap-2 pt-2 text-ink-muted">
              <span className="w-7 h-7 rounded-full bg-surface-elevated hover:bg-fight-red hover:text-ink flex items-center justify-center text-xs transition-colors cursor-pointer">
                f
              </span>
              <span className="w-7 h-7 rounded-full bg-surface-elevated hover:bg-fight-red hover:text-ink flex items-center justify-center text-xs transition-colors cursor-pointer">
                ✆
              </span>
              <span className="w-7 h-7 rounded-full bg-surface-elevated hover:bg-fight-red hover:text-ink flex items-center justify-center text-xs transition-colors cursor-pointer">
                𝕏
              </span>
              <span className="w-7 h-7 rounded-full bg-surface-elevated hover:bg-fight-red hover:text-ink flex items-center justify-center text-xs transition-colors cursor-pointer">
                o
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 font-mono-data text-xs">
            <p className="font-bold text-ink uppercase tracking-wider border-b border-subtle pb-2">
              {t("footerNavTitle")}
            </p>
            <ul className="space-y-2 text-ink-muted">
              <li>
                <Link href="/rankings" className="hover:text-fight-red transition-colors">
                  → {t("navRankings")}
                </Link>
              </li>
              <li>
                <Link href="/grand-prix" className="hover:text-fight-red transition-colors">
                  → {t("navGrandPrix")}
                </Link>
              </li>
              <li>
                <Link href="/belts" className="hover:text-fight-red transition-colors">
                  → {t("navBelts")}
                </Link>
              </li>
              <li>
                <Link href="/fighters" className="hover:text-fight-red transition-colors">
                  → {t("navAthletes")}
                </Link>
              </li>
              <li>
                <Link href="/fights" className="hover:text-fight-red transition-colors">
                  → {t("navFightHistory")}
                </Link>
              </li>
              <li>
                <Link href="/events" className="hover:text-fight-red transition-colors">
                  → {t("navEvents")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="mt-12 pt-8 border-t border-subtle flex flex-col sm:flex-row items-center justify-between gap-4 font-mono-data text-xs text-ink-subtle">
          <p>{t("footerCopyright")}</p>
          <div className="flex gap-4">
            <span className="hover:text-ink cursor-pointer transition-colors">{t("footerTerms")}</span>
            <span>•</span>
            <span className="hover:text-ink cursor-pointer transition-colors">{t("footerRules")}</span>
            <span>•</span>
            <span className="hover:text-ink cursor-pointer transition-colors">{t("footerPrivacy")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
