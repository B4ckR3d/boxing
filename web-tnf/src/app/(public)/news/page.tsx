import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getPublicGalleryData } from "@/server/services/gallery.service";
import { PublicNewsAndGallery } from "@/components/news/PublicNewsAndGallery";

export const revalidate = 60;

export const metadata = {
  title: "Berita & Galeri | TFN — Temanggung Fight Night",
  description:
    "Dokumentasi foto pertarungan Volume 1 - 5, rilis pers, dan cerita resmi seputar Temanggung Fight Night.",
};

export default async function NewsAndGalleryPage() {
  const data = await getPublicGalleryData();

  return (
    <div className="bg-canvas min-h-screen text-ink select-none transition-colors">
      {/* 1. Header Banner */}
      <div
        className="relative bg-cover bg-center py-20 border-b border-subtle text-center"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="font-display text-4xl sm:text-6xl text-ink uppercase font-black tracking-tight">
            BERITA & DOKUMENTASI GALERI TFN
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono-data text-xs text-ink-muted mt-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-ink transition-colors">
              BERANDA
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-ink-subtle" />
            <span className="text-fight-red font-bold">GALERI & RILIS PERS</span>
          </div>
          <p className="mt-4 max-w-2xl mx-auto text-sm leading-relaxed text-ink-muted">
            Arsip visual lengkap malam pertarungan (Volume 1 hingga Volume 5), sesi timbang badan, pengalungan sabuk juara, dan publikasi resmi ring tinju Temanggung.
          </p>
        </div>
      </div>

      {/* 2. Main Content: Gallery & Articles */}
      <div className="py-12">
        <PublicNewsAndGallery
          categories={data.categories}
          items={data.items}
          articles={data.articles}
        />
      </div>
    </div>
  );
}
