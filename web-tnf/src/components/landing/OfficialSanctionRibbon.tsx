"use client";

import React from "react";
import Image from "next/image";

interface Association {
  id: string;
  fullName: string;
  branch: string;
  logo: string;
}

const ASSOCIATIONS: Association[] = [
  {
    id: "perbati",
    fullName: "PENGURUS BESAR TINJU INDONESIA",
    branch: "WILAYAH KABUPATEN TEMANGGUNG",
    logo: "/images/partners/perbati-temanggung.png",
  },
  {
    id: "kbi",
    fullName: "PENGURUS CABANG KICKBOXING INDONESIA",
    branch: "WILAYAH KABUPATEN TEMANGGUNG",
    logo: "/images/partners/kickboxing-temanggung.png",
  },
];

export function OfficialSanctionRibbon() {
  return (
    <section
      aria-label="Asosiasi Resmi & Badan Sanksi"
      className="relative z-20 border-y border-subtle bg-charcoal/95 backdrop-blur-md shadow-2xl"
    >
      {/* Subtle top fight accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-fight-red via-gold/60 to-fight-red" />

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {/* Cards Asosiasi (2 Kotak Bersebelahan & Berimbang) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {ASSOCIATIONS.map((assoc) => (
            <div
              key={assoc.id}
              className="group relative flex items-center gap-4 sm:gap-5 bg-canvas/80 hover:bg-canvas p-4 sm:p-5 border border-subtle hover:border-fight-red/60 transition-all duration-300 shadow-md hover:shadow-[0_0_20px_rgba(0,0,0,0.5)]"
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
                <h3 className="font-display text-base sm:text-lg font-black uppercase tracking-tight text-ink leading-snug group-hover:text-fight-red transition-colors">
                  {assoc.fullName}
                </h3>
                <div className="mt-1.5 flex items-center gap-2">
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
    </section>
  );
}
