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
  { number: 8, range: "75 kg – 79 Kg", name: "Light Heavyweight", indonesianName: "Kelas Berat Ringan" },
  { number: 9, range: "80 kg – 84 Kg", name: "Cruiserweight", indonesianName: "Kelas Penjelajah" },
  { number: 10, range: "85+ Kg", name: "Heavyweight", indonesianName: "Kelas Berat" },
  { number: 11, range: "91+ Kg", name: "Super Heavyweight", indonesianName: "Kelas Berat Super" },
];

interface RuleCategory {
  id: "boxing" | "kickboxing";
  name: string;
  badge: string;
  desc: string;
}

const RULE_CATEGORIES: RuleCategory[] = [
  {
    id: "boxing",
    name: "Boxing",
    badge: "QUEENSBERRY RULES",
    desc: "Pukulan tinju murni, footwork, dan pertahanan standar tinju.",
  },
  {
    id: "kickboxing",
    name: "Kickboxing",
    badge: "LOW CONTACT",
    desc: "Kombinasi pukulan dan tendangan (low contact) terstandar.",
  },
];

export interface ExhibitionConfig {
  isEnabled?: boolean;
  badge?: string;
  title?: string;
  rulesText?: string;
  whatsappNumber?: string;
  ctaLabel?: string;
  closedDivisions?: string;
}

export function MatchupShowcase({ config }: { config?: ExhibitionConfig } = {}) {
  if (config?.isEnabled === false) return null;

  const { lang } = useLanguage();
  const [selectedRule, setSelectedRule] = useState<"all" | "boxing" | "kickboxing">("all");

  const badge = config?.badge || "VOL. 6 EXHIBITION";
  const title = config?.title || (lang === "id" ? "SETIAP RONDE PUNYA CERITA." : "EVERY ROUND HAS A STORY.");
  const rulesText = config?.rulesText || "Rules: Boxing & Kickboxing (Low Contact) · Terbuka untuk 11 Kelas Timbangan";

  // Kontak Resmi (Kontak 2: +62 858-4800-0639)
  const rawWa = config?.whatsappNumber?.replace(/\D/g, "") || "6285848000639";
  const waNumber = rawWa.startsWith("0") ? `62${rawWa.slice(1)}` : rawWa;
  const ctaLabel = config?.ctaLabel || "DAFTAR PARTAI VIA WA";

  const closedSet = new Set(
    (config?.closedDivisions || "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))
  );

  const getRuleLabel = () => {
    if (selectedRule === "boxing") return "Boxing";
    if (selectedRule === "kickboxing") return "Kickboxing";
    return "[ Boxing / Kickboxing ]";
  };

  const getWaLink = (divName: string, range: string) => {
    const ruleLabel = getRuleLabel();
    const text = [
      "Halo, Admin TFN !",
      "",
      `Saya ingin mendaftar Temanggung Fight Night Vol.6 Exhibition di Divisi ${divName} (${range})`,
      "",
      `Kategori Rules: ${ruleLabel}`,
      "Kelas : [ Atlet / Pemula / Non Atlet ]",
      "",
      "Apakah masih ada slot ?",
    ].join("\n");
    return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
  };

  const getHeaderWaLink = () => {
    const ruleLabel = getRuleLabel();
    const text = [
      "Halo, Admin TFN !",
      "",
      "Saya ingin mendaftar Temanggung Fight Night Vol.6 Exhibition di Divisi ...",
      "",
      `Kategori Rules: ${ruleLabel}`,
      "Kelas : [ Atlet / Pemula / Non Atlet ]",
      "",
      "Apakah masih ada slot ?",
    ].join("\n");
    return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
  };

  return (
    <section className="border-b border-subtle bg-canvas py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* 1. Header Judul & Tombol WA Pendaftaran */}
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

          <a
            href={getHeaderWaLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-fight-red hover:bg-fight-red-hover text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors shrink-0 shadow-lg"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{ctaLabel}</span>
          </a>
        </div>

        {/* 2. Pilihan 2 Kategori Rules: BOXING dan KICKBOXING */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono-data text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-muted font-bold">
              PILIH KATEGORI RULES:
            </p>
            {selectedRule !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedRule("all")}
                className="font-mono-data text-[10px] text-fight-red hover:underline uppercase tracking-wider font-bold cursor-pointer"
              >
                Tampilkan Semua Rules
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {RULE_CATEGORIES.map((rule) => {
              const isSelected = selectedRule === rule.id;
              return (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => setSelectedRule(isSelected ? "all" : rule.id)}
                  className={`group relative p-4 text-left border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "border-fight-red bg-fight-red/10 text-white shadow-lg ring-1 ring-fight-red"
                      : "border-subtle bg-charcoal/60 hover:bg-charcoal hover:border-fight-red/50 text-ink"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xl sm:text-2xl font-black uppercase tracking-wider text-ink group-hover:text-fight-red transition-colors">
                      {rule.name}
                    </span>
                    <span
                      className={`font-mono-data text-[10px] font-bold uppercase px-2.5 py-0.5 tracking-wider transition-colors ${
                        isSelected
                          ? "bg-fight-red text-white"
                          : "bg-surface text-ink-muted border border-subtle group-hover:border-fight-red/40"
                      }`}
                    >
                      {rule.badge}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm leading-snug text-ink-muted font-mono-data">
                    {rule.desc}
                  </p>
                  {isSelected && (
                    <div className="absolute top-0 right-0 -mt-1.5 -mr-1.5 w-3 h-3 bg-fight-red rounded-full ring-2 ring-canvas" />
                  )}
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
                    <a
                      href={getWaLink(div.name, div.range)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full bg-fight-red hover:bg-fight-red-hover text-white font-display font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:scale-105 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      <span>Daftar</span>
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </a>
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
