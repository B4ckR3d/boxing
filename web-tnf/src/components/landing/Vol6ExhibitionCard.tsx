"use client";

import React, { useState } from "react";
import { CheckCircle2, MessageSquare, Sparkles } from "lucide-react";

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
    <div className="w-full border border-subtle bg-charcoal/90 p-5 sm:p-7 shadow-2xl transition-all">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-fight-red text-white font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              VOL. 6 EXHIBITION
            </span>
            <span className="font-mono-data text-[11px] text-gold font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-gold" /> LOW CONTACT
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-black uppercase text-ink mt-2 leading-tight">
            KELAS TANDING & REGULASI SETIAP PARTAI
          </h3>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Rules: Boxing & Kickboxing (Low Contact) · Terbuka untuk 11 Kelas Timbangan
          </p>
        </div>

        <a
          href="https://wa.me/6285714883551?text=Halo%20Admin%20TFN,%20saya%20ingin%20tanya%20seputar%20pendaftaran%20dan%20ketersediaan%20slot%20TFN%20Vol.6%20Exhibition."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-fight-red hover:bg-fight-red-hover text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors shrink-0 shadow-lg"
        >
          <MessageSquare className="w-4 h-4" />
          <span>DAFTAR PARTAI VIA WA</span>
        </a>
      </div>

      {/* 3 Kategori Skill */}
      <div className="py-5 border-b border-subtle">
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

      {/* Daftar 11 Kelas Berat (Lebar: 2 Kolom Grid di Layar Sedang & Besar) */}
      <div className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted font-bold">
            STATUS KETERSEDIAAN 11 DIVISI KELAS BERAT:
          </p>
          <span className="font-mono-data text-[10px] text-green-400 font-bold uppercase flex items-center gap-1.5 bg-green-950/40 border border-green-800/40 px-2.5 py-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SEMUA SLOT DIBUKA
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DIVISIONS.map((div) => (
            <div
              key={div.number}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-3.5 bg-canvas/80 border border-subtle hover:border-fight-red/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center font-mono-data text-xs font-bold bg-charcoal text-ink-muted border border-subtle">
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

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                <span className="inline-flex items-center gap-1 font-mono-data text-[10px] font-bold text-green-400 bg-green-950/40 border border-green-800/40 px-2 py-0.5">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  TERSEDIA
                </span>

                <a
                  href={getWaLink(div.name, div.range)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-data text-[11px] font-bold text-ink hover:text-fight-red underline uppercase"
                >
                  Daftar →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
