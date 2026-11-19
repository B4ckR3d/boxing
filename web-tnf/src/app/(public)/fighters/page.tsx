import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, ArrowUpRight, MessageSquare, Swords, Shield, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Roster Petarung — Coming Soon | TFN Temanggung Fight Night",
  description:
    "Roster resmi dan lineup petarung Temanggung Fight Night Vol. 6 Exhibition segera diumumkan. Pendaftaran atlet untuk 11 kelas timbangan terbuka via WhatsApp.",
};

export const revalidate = 60;

const DIVISIONS = [
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

export default function PublicFightersPage() {
  const getWaLink = (divName?: string, range?: string) => {
    const text = divName
      ? `Halo Admin TFN, saya ingin mendaftar sebagai petarung di Temanggung Fight Night Vol.6 Exhibition divisi ${divName} (${range}). Bagaimana alur pendaftarannya?`
      : "Halo Admin TFN, saya ingin mendaftar sebagai petarung di Temanggung Fight Night Vol.6 Exhibition. Mohon informasi syarat dan alurnya.";
    return `https://wa.me/6285714883551?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="bg-canvas min-h-screen text-ink select-none">
      {/* 1. Header Banner Sinematik dengan Foto Teaser Baru */}
      <div
        className="relative bg-cover bg-center py-20 sm:py-28 border-b border-subtle"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(11,11,13,0.82) 0%, rgba(11,11,13,0.94) 70%, #0b0b0d 100%), url('/images/fighters/coming-soon-banner.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-fight-red/20 border border-fight-red/40 px-3 py-1 font-mono-data text-[11px] font-bold uppercase tracking-widest text-fight-red">
            <Clock className="w-3.5 h-3.5" />
            <span>COMING SOON · ROSTER ANNOUNCEMENT</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl uppercase font-black text-ink tracking-tight leading-none">
            DIREKTORI PETARUNG TFN
          </h1>

          <p className="font-mono-data text-xs sm:text-sm text-ink-muted max-w-2xl mx-auto uppercase tracking-wider leading-relaxed">
            Lineup resmi atlet & kartu petarung Temanggung Fight Night Vol. 6 Exhibition sedang dalam proses matchmaking dan kurasi timbang badan.
          </p>

          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted pt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">
              BERANDA / HOME
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-muted" />
            <span className="text-fight-red font-bold">ROSTER PETARUNG</span>
          </div>
        </div>
      </div>

      {/* 2. Spotlight Hero: Poster Teaser & Detail Matchmaking */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-charcoal border border-subtle grid grid-cols-1 lg:grid-cols-12 overflow-hidden shadow-2xl">
          {/* Sisi Kiri: Foto Teaser Petarung Sinematik Baru */}
          <div className="lg:col-span-5 relative bg-black min-h-[380px] lg:min-h-[520px] overflow-hidden group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/fighters/coming-soon-fighter.jpg"
              alt="TFN Fighter Coming Soon"
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-transparent to-black/30 lg:hidden" />

            <div className="absolute top-4 left-4">
              <span className="bg-fight-red text-white font-mono-data text-[10px] font-black uppercase px-2.5 py-1 tracking-wider shadow-md">
                VOL. 6 EXHIBITION
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4 p-3 bg-black/80 backdrop-blur-md border border-white/10">
              <div className="flex items-center justify-between font-mono-data text-[10px] text-ink-muted uppercase">
                <span>LINEUP STATUS</span>
                <span className="text-fight-red font-bold">SEGERA DIRILIS</span>
              </div>
              <p className="font-display text-sm font-black text-white uppercase tracking-wider mt-0.5">
                MATCHMAKING IN PROGRESS
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Penjelasan & Alur Pendaftaran */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-fight-red" />
                <span className="font-mono-data text-xs text-fight-red font-bold uppercase tracking-widest">
                  FASE VERIFIKASI & KURASI MATCH
                </span>
              </div>

              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-ink leading-tight">
                ROSTER PETARUNG SEDANG DIKOMPILASI.
              </h2>

              <p className="font-mono-data text-xs sm:text-sm text-ink-muted leading-relaxed">
                Pendaftaran atlet untuk <strong className="text-white">11 kelas timbangan</strong> di Temanggung Fight Night Vol. 6 Exhibition (Boxing & Kickboxing Low Contact) sedang dibuka bagi seluruh sasana, komunitas bela diri, dan atlet regional.
              </p>
              <p className="font-mono-data text-xs sm:text-sm text-ink-muted leading-relaxed">
                Profil lengkap atlet, rekor bertanding, dan penentuan partai lawan (matchup) akan ditayangkan pada halaman ini setelah verifikasi timbangan resmi disahkan oleh panitia.
              </p>

              {/* Grid 4 Telemetri Nilai */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                <div className="bg-canvas border border-subtle p-3 text-center">
                  <span className="font-display text-2xl font-black text-fight-red block">11</span>
                  <span className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider">Divisi Berat</span>
                </div>
                <div className="bg-canvas border border-subtle p-3 text-center">
                  <span className="font-display text-2xl font-black text-white block">3</span>
                  <span className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider">Kategori Skill</span>
                </div>
                <div className="bg-canvas border border-subtle p-3 text-center">
                  <span className="font-display text-xl sm:text-2xl font-black text-white block">LOW</span>
                  <span className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider">Contact Rules</span>
                </div>
                <div className="bg-canvas border border-subtle p-3 text-center">
                  <span className="font-display text-2xl font-black text-emerald-400 block">OPEN</span>
                  <span className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider">Pendaftaran</span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="pt-6 border-t border-subtle flex flex-wrap items-center gap-4">
              <a
                href={getWaLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#FFCF1F] hover:bg-[#ffd84d] text-black font-display font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:scale-105 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                <span>DAFTAR PARTAI VIA WA</span>
              </a>

              <Link
                href="/"
                className="inline-flex min-h-12 items-center gap-2 border border-subtle px-6 text-xs font-mono-data font-bold uppercase tracking-wider hover:border-fight-red transition-colors"
              >
                <span>KEMBALI KE BERANDA</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 3. Daftar 11 Divisi Matchmaking yang Sedang Dibuka */}
        <div className="mt-16 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-subtle pb-4">
            <div>
              <p className="font-mono-data text-xs text-fight-red font-bold uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                <span>DIVISI KELAS TIMBANGAN DIBUKA</span>
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-ink mt-1">
                STATUS KETERSEDIAAN PARTAI TFN VOL. 6
              </h3>
            </div>
            <p className="font-mono-data text-[11px] text-ink-muted">
              Pilih kelas timbangan Anda dan hubungi admin untuk pencocokan lawan:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {DIVISIONS.map((div) => (
              <div
                key={div.number}
                className="bg-charcoal/80 border border-subtle hover:border-fight-red/60 p-4 flex flex-col justify-between gap-3 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center font-mono-data text-xs font-bold bg-canvas text-ink-muted border border-subtle">
                    {div.number}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-data text-sm font-black text-white">
                        {div.range}
                      </span>
                    </div>
                    <p className="font-display text-sm font-bold uppercase text-fight-red mt-0.5">
                      {div.name}
                    </p>
                    <p className="text-[11px] font-mono-data text-ink-muted">
                      {div.indonesianName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="inline-flex items-center gap-1 font-mono-data text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>SLOT DIBUKA</span>
                  </span>

                  <a
                    href={getWaLink(div.name, div.range)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFCF1F] hover:bg-[#ffd84d] text-black font-display font-black text-[10px] uppercase tracking-wider border border-black shadow-[1.5px_1.5px_0px_#000] hover:scale-105 active:shadow-none transition-all"
                  >
                    <span>Daftar Kelas</span>
                    <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
