"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ticketingUrl } from "@/lib/ticketing/external";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface WeightDivision {
  number: number;
  range: string;
  name: string;
  indonesianName: string;
}

const DIVISIONS: WeightDivision[] = [
  { number: 1, range: "51 kg – 53 Kg", name: "Bantamweight", indonesianName: "Kelas Bantam" },
  { number: 2, range: "54 kg – 56 Kg", name: "Featherweight", indonesianName: "Kelas Bulu" },
  { number: 3, range: "57 kg – 59 Kg", name: "Super Featherweight", indonesianName: "Kelas Bulu Super" },
  { number: 4, range: "60 kg – 63 Kg", name: "Light Welterweight", indonesianName: "Kelas Welter Ringan" },
  { number: 5, range: "64 kg – 66 Kg", name: "Welterweight", indonesianName: "Kelas Welter" },
  { number: 6, range: "67 kg – 69 Kg", name: "Light Middleweight", indonesianName: "Kelas Menengah Ringan" },
  { number: 7, range: "70 kg – 74 Kg", name: "Middleweight", indonesianName: "Kelas Menengah" },
  { number: 8, range: "75 kg – 79 Kg", name: "Light Heavyweight", indonesianName: "Kelas Berat" },
  { number: 9, range: "80 kg – 84 Kg", name: "Cruiserweight", indonesianName: "Kelas Penjelajah" },
  { number: 10, range: "85+ Kg", name: "Heavyweight", indonesianName: "Kelas Berat" },
  { number: 11, range: "91+ Kg", name: "Super Heavyweight", indonesianName: "Kelas Berat Super" },
];

const SKILL_TIERS = [
  {
    id: "non-atlet",
    name: "Non Atlet",
    desc: "Belum terlatih dan bertanding",
    badge: "UMUM & KOMUNITAS",
  },
  {
    id: "pemula",
    name: "Pemula",
    desc: "Terlatih tapi belum bertanding",
    badge: "MEMBER SASANA",
  },
  {
    id: "atlet",
    name: "Atlet",
    desc: "Terlatih dan berpengalaman bertanding",
    badge: "EXPERIENCED",
  },
];

export interface ExhibitionConfig {
  isEnabled?: boolean;
  badge?: string;
  title?: string;
  rulesText?: string;
  whatsappNumber?: string;
  whatsappNumber2?: string;
  ctaLabel?: string;
  closedDivisions?: string;
}

export function MatchupShowcase({ config }: { config?: ExhibitionConfig } = {}) {
  if (config?.isEnabled === false) return null;

  const { lang } = useLanguage();
  const [selectedSkill, setSelectedSkill] = useState<string>("all");

  const badge = config?.badge || "VOL. 6 EXHIBITION";
  const title = config?.title || (lang === "id" ? "SETIAP RONDE PUNYA CERITA." : "EVERY ROUND HAS A STORY.");
  const rulesText = config?.rulesText || "Rules: Boxing & Kickboxing (Low Contact) · Terbuka untuk 11 Kelas Timbangan";

  // Kontak 1 (+62 813-9082-3332)
  const rawWa1 = config?.whatsappNumber?.replace(/\D/g, "") || "6281390823332";
  const waNumber1 = rawWa1.startsWith("0") ? `62${rawWa1.slice(1)}` : rawWa1;

  // Kontak 2 (+62 858-4800-0639)
  const rawWa2 = config?.whatsappNumber2?.replace(/\D/g, "") || "6285848000639";
  const waNumber2 = rawWa2.startsWith("0") ? `62${rawWa2.slice(1)}` : rawWa2;

  const closedSet = new Set(
    (config?.closedDivisions || "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))
  );

  const getWaLink = (divName: string, range: string, waNum: string, contactIdx: number) => {
    const skillName =
      selectedSkill === "all"
        ? "(Pilih Skill)"
        : SKILL_TIERS.find((s) => s.id === selectedSkill)?.name || "";
    const msg = encodeURIComponent(
      `Halo Admin TFN (Kontak ${contactIdx}), saya ingin mendaftar Temanggung Fight Night Vol.6 Exhibition di divisi ${divName} (${range}) kategori skill: ${skillName}. Apakah slotnya masih tersedia?`
    );
    return `https://wa.me/${waNum}?text=${msg}`;
  };

  const getHeaderWaLink = (waNum: string, contactIdx: number) => {
    return `https://wa.me/${waNum}?text=${encodeURIComponent(
      `Halo Admin TFN (Kontak ${contactIdx}), saya ingin tanya seputar pendaftaran dan ketersediaan slot TFN Vol.6 Exhibition.`
    )}`;
  };

  return (
    <section className="border-b border-subtle bg-canvas py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* 1. Header Judul & Tombol WA Pendaftaran (Kontak 1 & Kontak 2) */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-subtle">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-fight-red text-white font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                {badge}
              </span>
              <span className="text-[11px] font-mono-data text-ink-muted font-bold hidden sm:inline">
                {rulesText}
              </span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-black uppercase text-ink leading-tight tracking-tight">
              {title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={getHeaderWaLink(waNumber1, 1)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-fight-red hover:bg-fight-red-hover text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95"
              title="Hubungi Kontak 1 (+62 813-9082-3332)"
            >
              <MessageSquare className="w-4 h-4" />
              <span>DAFTAR (KONTAK 1)</span>
            </a>

            <a
              href={getHeaderWaLink(waNumber2, 2)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#FFCF1F] hover:bg-[#ffd84d] text-black px-4 py-2.5 text-xs font-display font-black uppercase tracking-wider border-2 border-black/20 transition-all shadow-lg active:scale-95"
              title="Hubungi Kontak 2 (+62 858-4800-0639)"
            >
              <MessageSquare className="w-4 h-4 text-black" />
              <span>DAFTAR (KONTAK 2)</span>
            </a>
          </div>
        </div>

        {/* 2. Pilihan 3 Kategori Pengalaman / Skill (Dipindah ke atas) */}
        <div>
          <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-3">
            PILIH KATEGORI PENGALAMAN / SKILL:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SKILL_TIERS.map((tier) => {
              const isSelected = selectedSkill === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedSkill(isSelected ? "all" : tier.id)}
                  className={`p-3.5 text-left border transition-all ${
                    isSelected
                      ? "border-fight-red bg-fight-red/10 text-white shadow-md ring-1 ring-fight-red"
                      : "border-subtle bg-canvas/60 hover:bg-canvas text-ink"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-base font-black uppercase tracking-wide">
                      {tier.name}
                    </span>
                    <span
                      className={`font-mono-data text-[9px] font-bold uppercase px-2 py-0.5 ${
                        isSelected
                          ? "bg-fight-red text-white"
                          : "bg-charcoal text-ink-muted border border-white/10"
                      }`}
                    >
                      {tier.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-ink-muted font-mono-data">
                    {tier.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Daftar 11 Divisi Kelas Berat (2 Kolom Lebar) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted font-bold">
              STATUS KETERSEDIAAN 11 DIVISI KELAS BERAT:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DIVISIONS.map((div) => (
              <div
                key={div.number}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 bg-charcoal/80 border border-subtle hover:border-fight-red/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center font-mono-data text-xs font-bold bg-canvas text-ink-muted border border-subtle">
                    {div.number}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-data text-sm font-black text-white">
                        {div.range}
                      </span>
                      <span className="font-display text-sm font-bold uppercase text-fight-red">
                        {div.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono-data text-ink-muted">
                      {div.indonesianName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  {closedSet.has(div.number) ? (
                    <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white/10 text-ink-muted font-display font-bold text-xs uppercase tracking-wider border border-white/15">
                      Slot Penuh
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <a
                        href={getWaLink(div.name, div.range, waNumber1, 1)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-[#FFCF1F] hover:bg-[#ffd84d] text-black font-display font-black text-[11px] uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:scale-105 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                        title="Daftar via Kontak 1 (+62 813-9082-3332)"
                      >
                        <span>Kontak 1</span>
                        <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                      </a>
                      <a
                        href={getWaLink(div.name, div.range, waNumber2, 2)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-white hover:bg-neutral-200 text-black font-display font-black text-[11px] uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:scale-105 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                        title="Daftar via Kontak 2 (+62 858-4800-0639)"
                      >
                        <span>Kontak 2</span>
                        <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Kedua Tombol Asli (Dipindah ke Bagian Bawah) */}
        <div className="pt-6 border-t border-subtle flex flex-wrap items-center gap-4">
          <Link
            href="/fighters"
            className="inline-flex min-h-12 items-center gap-4 border border-subtle px-6 text-sm font-bold hover:border-fight-red transition-colors"
          >
            {lang === "id" ? "Kenali petarung" : "Meet the fighters"}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={ticketingUrl("/")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center gap-4 bg-fight-red px-6 text-sm font-bold text-white hover:bg-fight-red-hover transition-colors"
          >
            {lang === "id" ? "Cari tiket" : "Find tickets"}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
