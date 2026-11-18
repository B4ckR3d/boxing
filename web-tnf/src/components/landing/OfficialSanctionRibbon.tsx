"use client";

import React from "react";
import Image from "next/image";
import { ShieldCheck, Award } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Association {
  id: string;
  name: string;
  fullName: string;
  branch: string;
  role: { id: string; en: string };
  logo: string;
  color: string;
}

const ASSOCIATIONS: Association[] = [
  {
    id: "perbati",
    name: "PERBATI",
    fullName: "PENGURUS BESAR TINJU INDONESIA",
    branch: "KABUPATEN TEMANGGUNG",
    role: {
      id: "BADAN SANKSIONING & REGULASI TINJU",
      en: "OFFICIAL BOXING SANCTIONING BODY",
    },
    logo: "/images/partners/perbati-temanggung.png",
    color: "#e50914",
  },
  {
    id: "kbi",
    name: "KICKBOXING INDONESIA",
    fullName: "PENGURUS CABANG KICKBOXING INDONESIA",
    branch: "KABUPATEN TEMANGGUNG",
    role: {
      id: "ASOSIASI RESMI CABANG KICKBOXING",
      en: "OFFICIAL KICKBOXING ASSOCIATION",
    },
    logo: "/images/partners/kickboxing-temanggung.png",
    color: "#2563eb",
  },
];

export function OfficialSanctionRibbon() {
  const { lang } = useLanguage();
  const isEn = lang === "en";

  return (
    <section
      aria-label={isEn ? "Official Sanctioning Bodies" : "Asosiasi Resmi & Badan Sanksi"}
      className="relative z-20 border-y border-subtle bg-charcoal/95 backdrop-blur-md shadow-2xl"
    >
      {/* Subtle top fight accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-fight-red via-gold/60 to-fight-red" />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
          {/* Label Header Kiri */}
          <div className="flex items-start sm:items-center gap-3.5 lg:max-w-xs shrink-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-none border border-fight-red/40 bg-fight-red/10 text-fight-red shadow-[0_0_15px_rgba(229,9,20,0.2)]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono-data text-[10px] font-bold uppercase tracking-[0.2em] text-fight-red">
                  {isEn ? "SANCTIONED & CERTIFIED" : "TERLISENSI & DIAWASI"}
                </span>
                <span className="inline-block h-1 w-1 rounded-full bg-fight-red animate-pulse" />
              </div>
              <h2 className="font-display text-lg sm:text-xl font-black uppercase tracking-tight text-ink leading-tight mt-0.5">
                {isEn ? "OFFICIAL ASSOCIATIONS" : "ASOSIASI RESMI OLAHRAGA COMBAT"}
              </h2>
              <p className="font-mono-data text-[11px] text-ink-muted leading-tight mt-0.5">
                {isEn
                  ? "Officially regulated by recognized sports boards in Temanggung Regency."
                  : "Didukung penuh oleh pengurus cabang olahraga bela diri resmi Kabupaten Temanggung."}
              </p>
            </div>
          </div>

          {/* Cards Asosiasi (2 Kotak Bersebelahan) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {ASSOCIATIONS.map((assoc) => (
              <div
                key={assoc.id}
                className="group relative flex items-center gap-4 bg-canvas/80 hover:bg-canvas p-4 sm:p-5 border border-subtle hover:border-fight-red/60 transition-all duration-300 shadow-md hover:shadow-[0_0_20px_rgba(0,0,0,0.5)]"
              >
                {/* Logo Image */}
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 bg-charcoal/50 p-1.5 border border-white/5 group-hover:border-fight-red/30 transition-colors flex items-center justify-center">
                  <Image
                    src={assoc.logo}
                    alt={assoc.fullName}
                    width={160}
                    height={160}
                    className="h-full w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Info Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
                    <span className="font-mono-data text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gold truncate">
                      {isEn ? assoc.role.en : assoc.role.id}
                    </span>
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-black uppercase tracking-tight text-ink mt-1 leading-snug group-hover:text-fight-red transition-colors">
                    {assoc.fullName}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center bg-white/5 border border-white/10 px-2 py-0.5 font-mono-data text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      {assoc.branch}
                    </span>
                    <span className="font-mono-data text-[10px] text-fight-red font-bold">
                      ✓ RESMI
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
