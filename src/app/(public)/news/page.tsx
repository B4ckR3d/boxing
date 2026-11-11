import React from "react";
import Link from "next/link";
import { ChevronRight, ArrowRight, Calendar } from "lucide-react";

export const metadata = {
  title: "Berita & Sorotan | TFN - Temanggung Fight Night",
  description: "Kabar terbaru seputar kejuaraan tinju Temanggung Fight Night, wawancara petarung, dan hasil pertandingan.",
};

const NEWS_ARTICLES = [
  {
    id: 1,
    titleId: "MICHAEL BRYAN KEMBALI DINOBATKAN SEBAGAI PETARUNG TERBAIK",
    titleEn: "MICHAEL BRYAN WAS CHOSEN AGAIN AS BEST PLAYER",
    date: "24 DES",
    dateEn: "24 DEC",
    imageUrl: "/images/hero/boxing-ring-arena.jpg",
    excerptId: "Penampilan dominan di ring Temanggung mengukuhkan dominasi sang juara di panggung tinju nasional.",
    excerptEn: "Dominant ring performance in Temanggung cements the champion's standing on the national stage.",
  },
  {
    id: 2,
    titleId: "MARCUS VALE PERSIAPKAN SENJATA UTAMA JELANG DUEL 12 RONDE",
    titleEn: "MARCUS VALE PREPARES HEAVY ARSENAL FOR 12-ROUND TITLE DEFENSE",
    date: "24 DES",
    dateEn: "24 DEC",
    imageUrl: "/images/fighters/marcus-vale.jpg",
    excerptId: "Latihan intensif di sasana Bhumi Phala difokuskan untuk menghentikan agresi penantang nomor satu.",
    excerptEn: "High-intensity training at Bhumi Phala gym designed to neutralize the number one contender.",
  },
  {
    id: 3,
    titleId: "DARIO STORM AMANKAN TIKET FINAL GRAND PRIX KELAS BERAT",
    titleEn: "DARIO STORM SECURES HEAVYWEIGHT GRAND PRIX FINAL TICKET",
    date: "24 DES",
    dateEn: "24 DEC",
    imageUrl: "/images/fighters/dario-storm.jpg",
    excerptId: "Kemenangan spektakuler TKO ronde ke-5 mengirimkan pesan tegas kepada seluruh divisi.",
    excerptEn: "Spectacular 5th round TKO sends an undeniable shockwave across the heavyweight division.",
  },
  {
    id: 4,
    titleId: "KENJI ARATA: SAYA SIAP MEMBAWA SABUK EMAS PULANG",
    titleEn: "KENJI ARATA: I AM READY TO BRING THE GOLDEN BELT HOME",
    date: "24 DES",
    dateEn: "24 DEC",
    imageUrl: "/images/fighters/kenji-arata.jpg",
    excerptId: "Kecepatan dan teknik counter strike Arata diyakini menjadi ancaman terbesar bagi juara bertahan.",
    excerptEn: "Arata's precision hand speed and counter punching pose the greatest stylistic threat.",
  },
  {
    id: 5,
    titleId: "TOMAS REYES MENANG ANGKA MUTLAK DALAM DUEL ELIMINASI",
    titleEn: "TOMAS REYES CLAIMS UNANIMOUS DECISION IN ELIMINATION WAR",
    date: "24 DES",
    dateEn: "24 DEC",
    imageUrl: "/images/fighters/tomas-reyes.jpg",
    excerptId: "Pertarungan sengit 10 ronde menyajikan aksi jual beli pukulan terbaik musim ini.",
    excerptEn: "A grueling 10-round war produced the highest action volume and punch exchanges of the season.",
  },
  {
    id: 6,
    titleId: "KOMISI TFN RESMIKAN PROTOKOL RANKING DAN KEJUARAAN BARU",
    titleEn: "TFN COMMISSION RATIFIES NEW RANKING & CHAMPIONSHIP PROTOCOL",
    date: "24 DES",
    dateEn: "24 DEC",
    imageUrl: "/images/hero/boxing-ring-arena.jpg",
    excerptId: "Standarisasi audit independen diterapkan untuk menjamin keabsahan seluruh perebutan gelar.",
    excerptEn: "Independent cryptographic audit trails now enforce integrity across all championship bouts.",
  },
];

export default function NewsPage() {
  return (
    <div className="bg-canvas min-h-screen text-foreground select-none transition-colors">
      {/* 1. Header Banner (From Reference Image 5) */}
      <div
        className="relative bg-cover bg-center py-20 border-b border-border text-center"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="font-display text-4xl sm:text-6xl text-ink uppercase font-black tracking-tight">
            NEWS & BERITA RESMI
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted mt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">
              HOME / BERANDA
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">NEWS</span>
          </div>
        </div>
      </div>

      {/* 2. 3x2 Grid of News Cards (Matching Reference Image 5 Exactly) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {NEWS_ARTICLES.map((article) => (
            <div
              key={article.id}
              className="bg-card text-card-foreground border border-border group hover:border-fight-red transition-all duration-300 overflow-hidden shadow-lg flex flex-col justify-between"
            >
              {/* Image with Floating Red Date Badge (Image 5 style) */}
              <div className="relative h-60 w-full overflow-hidden bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.imageUrl}
                  alt={article.titleId}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Red Square Date Badge on Top-Left */}
                <div className="absolute top-4 left-4 bg-fight-red text-ink p-2.5 flex flex-col items-center justify-center shadow-lg min-w-[50px] leading-tight">
                  <Calendar className="w-4 h-4 mb-1" />
                  <span className="font-display font-black text-xs uppercase tracking-wider">
                    {article.date}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-lg sm:text-xl font-bold uppercase tracking-tight leading-snug group-hover:text-fight-red transition-colors">
                    {article.titleId}
                  </h3>
                  <p className="font-sans text-xs sm:text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {article.excerptId}
                  </p>
                </div>

                <div className="pt-4 border-t border-border">
                  <Link
                    href={`/events`}
                    className="inline-flex items-center gap-1.5 font-mono-data text-xs font-bold text-fight-red hover:underline tracking-wider uppercase group-hover:translate-x-1 transition-transform"
                  >
                    <span>→ MORE / SELENGKAPNYA</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

