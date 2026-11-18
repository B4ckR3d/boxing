"use client";

import React, { useState } from "react";
import { CheckCircle2, Swords, MessageSquare, ChevronDown, ChevronUp, Sparkles, Shield } from "lucide-react";

interface WeightDivision {
  number: number;
  range: string;
  name: string;
  indonesianName: string;
  status: "OPEN" | "MATCHING" | "LOCKED";
}

const DIVISIONS: WeightDivision[] = [
  { number: 1, range: "51 kg – 53 Kg", name: "Bantamweight", indonesianName: "Kelas Bantam", status: "OPEN" },
  { number: 2, range: "54 kg – 56 Kg", name: "Featherweight", indonesianName: "Kelas Bulu", status: "OPEN" },
  { number: 3, range: "57 kg – 59 Kg", name: "Super Featherweight", indonesianName: "Kelas Bulu Super", status: "OPEN" },
  { number: 4, range: "60 kg – 63 Kg", name: "Light Welterweight", indonesianName: "Kelas Welter Ringan", status: "OPEN" },
  { number: 5, range: "64 kg – 66 Kg", name: "Welterweight", indonesianName: "Kelas Welter", status: "OPEN" },
  { number: 6, range: "67 kg – 69 Kg", name: "Light Middleweight", indonesianName: "Kelas Menengah Ringan", status: "OPEN" },
  { number: 7, range: "70 kg – 74 Kg", name: "Middleweight", indonesianName: "Kelas Menengah", status: "OPEN" },
  { number: 8, range: "75 kg – 79 Kg", name: "Light Heavyweight", indonesianName: "Kelas Berat", status: "OPEN" },
  { number: 9, range: "80 kg – 84 Kg", name: "Cruiserweight", indonesianName: "Kelas Penjelajah", status: "OPEN" },
  { number: 10, range: "85+ Kg", name: "Heavyweight", indonesianName: "Kelas Berat", status: "OPEN" },
  { number: 11, range: "91+ Kg", name: "Super Heavyweight", indonesianName: "Kelas Berat Super", status: "OPEN" },
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

export function Vol6ExhibitionCard() {
  const [selectedSkill, setSelectedSkill] = useState<string>("all");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const displayedDivisions = isExpanded ? DIVISIONS : DIVISIONS.slice(0, 5);

  const getWaLink = (divName: string, range: string) => {
    const skillName =
      selectedSkill === "all"
        ? "(Pilih Skill)"
        : SKILL_TIERS.find((s) => s.id === selectedSkill)?.name || "";
    const msg = encodeURIComponent(
      `Halo Admin TFN, saya ingin mendaftar Temanggung Fight Night Vol.6 Exhibition di divisi ${divName} (${range}) kategori skill: ${skillName}. Apakah slotnya masih tersedia?`
    );
    return `https://wa.me/6285714883551?text=${msg}`;
  };

  return (
    <div className="mt-8 border border-subtle bg-charcoal/90 p-5 sm:p-6 shadow-xl transition-all">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-fight-red text-white font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              VOL. 6 EXHIBITION
            </span>
            <span className="font-mono-data text-[11px] text-gold font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-gold" /> LOW CONTACT
            </span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-black uppercase text-ink mt-1.5 leading-snug">
            KELAS TANDING & REGULASI SETIAP PARTAI
          </h3>
          <p className="font-mono-data text-xs text-ink-muted mt-0.5">
            Rules: Boxing & Kickboxing (Low Contact) · Terbuka untuk 11 Kelas Timbangan
          </p>
        </div>

        <a
          href="https://wa.me/6285714883551?text=Halo%20Admin%20TFN,%20saya%20ingin%20tanya%20seputar%20pendaftaran%20dan%20ketersediaan%20slot%20TFN%20Vol.6%20Exhibition."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-fight-red hover:bg-fight-red-hover text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors shrink-0 shadow-md"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>DAFTAR PARTAI VIA WA</span>
        </a>
      </div>

      {/* 3 Kategori Skill */}
      <div className="py-4 border-b border-subtle">
        <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-2.5">
          PILIH KATEGORI PENGALAMAN / SKILL:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {SKILL_TIERS.map((tier) => {
            const isSelected = selectedSkill === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedSkill(isSelected ? "all" : tier.id)}
                className={`p-3 text-left border transition-all ${
                  isSelected
                    ? "border-fight-red bg-fight-red/10 text-white shadow-md"
                    : "border-subtle bg-canvas/60 hover:bg-canvas text-ink"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-black uppercase tracking-wide">
                    {tier.name}
                  </span>
                  <span
                    className={`font-mono-data text-[8px] font-bold uppercase px-1.5 py-0.5 ${
                      isSelected
                        ? "bg-fight-red text-white"
                        : "bg-charcoal text-ink-muted border border-white/10"
                    }`}
                  >
                    {tier.badge}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-tight text-ink-muted font-mono-data">
                  {tier.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Daftar 11 Kelas Berat */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted font-bold">
            STATUS KETERSEDIAAN 11 DIVISI KELAS BERAT:
          </p>
          <span className="font-mono-data text-[10px] text-green-400 font-bold uppercase flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SLOT DIBUKA
          </span>
        </div>

        <div className="space-y-2">
          {displayedDivisions.map((div) => (
            <div
              key={div.number}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 sm:px-3.5 bg-canvas/80 border border-subtle hover:border-fight-red/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center font-mono-data text-[10px] font-bold bg-charcoal text-ink-muted border border-subtle">
                  {div.number}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-data text-xs sm:text-sm font-black text-white">
                      {div.range}
                    </span>
                    <span className="font-display text-xs sm:text-sm font-bold uppercase text-fight-red">
                      {div.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-data text-ink-muted">
                    {div.indonesianName}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-white/5">
                <span className="inline-flex items-center gap-1 font-mono-data text-[10px] font-bold text-green-400 bg-green-950/40 border border-green-800/40 px-2 py-0.5">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  TERSEDIA (OPEN)
                </span>

                <a
                  href={getWaLink(div.name, div.range)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-data text-[10px] font-bold text-ink hover:text-fight-red underline uppercase"
                >
                  Daftar Kelas Ini →
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Toggle Expand / Collapse */}
        <div className="mt-4 pt-3 border-t border-subtle flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 font-mono-data text-xs font-bold uppercase text-ink-muted hover:text-ink transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-fight-red" />
                <span>Tampilkan Lebih Sedikit (5 Kelas)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-fight-red" />
                <span>Lihat Seluruh 11 Kelas Berat ({DIVISIONS.length} Kelas Lengkap)</span>
              </>
            )}
          </button>

          <span className="font-mono-data text-[10px] text-ink-subtle uppercase">
            Total {DIVISIONS.length} Divisi Pertandingan
          </span>
        </div>
      </div>
    </div>
  );
}
