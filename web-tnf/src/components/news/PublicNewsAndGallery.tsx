"use client";

import React, { useState, useEffect } from "react";
import { Image, Newspaper, X, ChevronLeft, ChevronRight, Calendar, User, Sparkles, ZoomIn } from "lucide-react";

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  itemCount?: number;
}

export interface PublicGalleryItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  categoryId: string;
  categoryName?: string;
  categorySlug?: string;
  sortOrder: number;
  createdAt: string;
}

export interface PublicArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string | null;
  category: string;
  publishedAt: string;
  authorName: string;
}

export function PublicNewsAndGallery({
  categories,
  items,
  articles,
}: {
  categories: PublicCategory[];
  items: PublicGalleryItem[];
  articles: PublicArticle[];
}) {
  const [activeTab, setActiveTab] = useState<"gallery" | "news">("gallery");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Filtered Photos
  const filteredItems =
    selectedCategory === "all"
      ? items
      : items.filter((item) => item.categoryId === selectedCategory || item.categorySlug === selectedCategory);

  // Active item in lightbox
  const activeLightboxItem = lightboxIndex !== null ? filteredItems[lightboxIndex] : null;

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, filteredItems.length]);

  const handlePrev = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : filteredItems.length - 1));
  };

  const handleNext = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) => (prev! < filteredItems.length - 1 ? prev! + 1 : 0));
  };

  // Article reading modal
  const [readingArticle, setReadingArticle] = useState<PublicArticle | null>(null);

  return (
    <div className="space-y-12">
      {/* Tab Switcher */}
      <div className="flex justify-center border-b border-subtle">
        <div className="inline-flex gap-4 p-1.5 bg-charcoal border border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab("gallery")}
            className={`inline-flex items-center gap-2 px-6 py-2.5 font-display text-sm uppercase tracking-wider font-bold transition-all ${
              activeTab === "gallery"
                ? "bg-fight-red text-white shadow-md"
                : "text-ink-muted hover:text-ink hover:bg-canvas"
            }`}
          >
            <Image className="w-4 h-4" />
            <span>Dokumentasi Galeri ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("news")}
            className={`inline-flex items-center gap-2 px-6 py-2.5 font-display text-sm uppercase tracking-wider font-bold transition-all ${
              activeTab === "news"
                ? "bg-fight-red text-white shadow-md"
                : "text-ink-muted hover:text-ink hover:bg-canvas"
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>Rilis Berita & Cerita ({articles.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW: GALERI FOTO */}
      {activeTab === "gallery" && (
        <div className="space-y-10">
          {/* Category Filter Pills (Volume 1 - 5, dll) */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-5xl mx-auto px-4">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 font-mono-data text-xs font-bold uppercase tracking-wider border transition-all ${
                selectedCategory === "all"
                  ? "bg-fight-red border-fight-red text-white shadow-md"
                  : "bg-charcoal border-subtle text-ink-muted hover:text-ink hover:border-fight-red"
              }`}
            >
              Semua Foto ({items.length})
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 font-mono-data text-xs font-bold uppercase tracking-wider border transition-all ${
                  selectedCategory === cat.id
                    ? "bg-fight-red border-fight-red text-white shadow-md"
                    : "bg-charcoal border-subtle text-ink-muted hover:text-ink hover:border-fight-red"
                }`}
              >
                {cat.name} ({cat.itemCount || 0})
              </button>
            ))}
          </div>

          {/* Subtitle Info */}
          <div className="text-center">
            <p className="font-mono-data text-xs text-ink-muted uppercase tracking-widest">
              Menampilkan {filteredItems.length} foto dokumentasi pertandingan
            </p>
          </div>

          {/* Grid Foto Galeri */}
          {filteredItems.length === 0 ? (
            <div className="p-16 border border-subtle bg-charcoal text-center space-y-3 max-w-2xl mx-auto">
              <Image className="w-12 h-12 text-ink-muted mx-auto opacity-40" />
              <h3 className="font-display text-xl uppercase font-bold text-ink">Belum Ada Foto Pada Kategori Ini</h3>
              <p className="text-sm text-ink-muted">Dokumentasi momen laga akan segera diunggah oleh tim redaksi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {filteredItems.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => setLightboxIndex(index)}
                  className="group relative cursor-pointer border border-subtle bg-charcoal overflow-hidden shadow-lg hover:border-fight-red transition-all flex flex-col justify-between"
                >
                  {/* Photo Container */}
                  <div className="relative aspect-[4/3] w-full bg-black overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                    {/* Category Pill Tag */}
                    <div className="absolute top-3 left-3 bg-fight-red text-white font-mono-data text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 shadow-md">
                      {item.categoryName || "Galeri"}
                    </div>

                    {/* Hover Zoom Icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="p-2.5 rounded-full bg-black/70 text-white border border-fight-red/50">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold uppercase text-ink line-clamp-2 leading-tight">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-ink-muted line-clamp-2 mt-1.5 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-subtle flex items-center justify-between text-[10px] font-mono-data text-ink-muted uppercase">
                      <span>Dokumentasi TFN</span>
                      <span className="text-fight-red font-bold">Lihat Detail →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: ARTIKEL BERITA */}
      {activeTab === "news" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {articles.length === 0 ? (
            <div className="p-16 border border-subtle bg-charcoal text-center space-y-3 max-w-2xl mx-auto">
              <Newspaper className="w-12 h-12 text-ink-muted mx-auto opacity-40" />
              <h3 className="font-display text-xl uppercase font-bold text-ink">Belum Ada Artikel Berita Terbit</h3>
              <p className="text-sm text-ink-muted">Pembaruan berita resmi akan segera dipublikasikan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map((art) => (
                <div
                  key={art.id}
                  onClick={() => setReadingArticle(art)}
                  className="group cursor-pointer border border-subtle bg-charcoal hover:border-fight-red transition-all flex flex-col justify-between overflow-hidden shadow-lg"
                >
                  <div className="relative aspect-[16/9] w-full bg-black overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={art.coverUrl || "/images/hero/boxing-ring-arena.jpg"}
                      alt={art.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-fight-red text-white font-mono-data text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5">
                      {art.category}
                    </div>
                  </div>

                  <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-mono-data text-xs text-ink-muted">
                        <Calendar className="w-3.5 h-3.5 text-fight-red" />
                        <span>{new Date(art.publishedAt).toLocaleDateString("id-ID")}</span>
                        <span>·</span>
                        <User className="w-3.5 h-3.5" />
                        <span>{art.authorName}</span>
                      </div>
                      <h3 className="font-display text-xl font-bold uppercase text-ink group-hover:text-fight-red transition-colors leading-tight">
                        {art.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-ink-muted line-clamp-3">
                        {art.excerpt}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-subtle flex items-center justify-between text-xs font-mono-data font-bold text-fight-red uppercase">
                      <span>BACA SELENGKAPNYA</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX MODAL UNTUK FOTO GALERI */}
      {activeLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxIndex(null);
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Tutup foto"
            className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-charcoal/80 border border-subtle text-white hover:bg-fight-red transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev Button */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Foto sebelumnya"
            className="absolute left-3 sm:left-6 z-30 p-3 rounded-full bg-charcoal/80 border border-subtle text-white hover:bg-fight-red transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Next Button */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Foto berikutnya"
            className="absolute right-3 sm:right-6 z-30 p-3 rounded-full bg-charcoal/80 border border-subtle text-white hover:bg-fight-red transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Modal Content */}
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center space-y-4">
            <div className="relative max-h-[70vh] w-full flex items-center justify-center overflow-hidden border border-subtle bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeLightboxItem.imageUrl}
                alt={activeLightboxItem.title}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Lightbox Caption Card */}
            <div className="w-full bg-charcoal border border-subtle p-4 sm:p-5 text-ink space-y-1.5 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono-data text-xs text-fight-red font-bold uppercase tracking-wider">
                  {activeLightboxItem.categoryName || "Galeri TFN"} · Foto {lightboxIndex! + 1} dari {filteredItems.length}
                </span>
                <span className="font-mono-data text-[10px] text-ink-muted">
                  Tekan [ESC] atau klik luar untuk menutup
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight text-ink">
                {activeLightboxItem.title}
              </h2>
              {activeLightboxItem.description && (
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  {activeLightboxItem.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ARTICLE READING MODAL */}
      {readingArticle && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReadingArticle(null);
          }}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] bg-charcoal border-2 border-fight-red overflow-y-auto p-6 sm:p-10 space-y-6 text-ink shadow-2xl">
            <button
              type="button"
              onClick={() => setReadingArticle(null)}
              aria-label="Tutup artikel"
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-ink-muted hover:text-white hover:bg-fight-red transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-3 border-b border-subtle pb-5">
              <div className="flex items-center gap-2 font-mono-data text-xs text-fight-red font-bold uppercase">
                <span>{readingArticle.category}</span>
                <span>·</span>
                <span>{new Date(readingArticle.publishedAt).toLocaleDateString("id-ID")}</span>
                <span>·</span>
                <span className="text-ink-muted">Oleh {readingArticle.authorName}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-black uppercase tracking-tight text-ink leading-tight">
                {readingArticle.title}
              </h2>
            </div>

            {readingArticle.coverUrl && (
              <div className="aspect-[16/9] w-full bg-black overflow-hidden border border-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={readingArticle.coverUrl}
                  alt={readingArticle.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="prose prose-invert max-w-none text-ink-muted text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-line">
              {readingArticle.content}
            </div>

            <div className="pt-4 border-t border-subtle text-right">
              <button
                type="button"
                onClick={() => setReadingArticle(null)}
                className="px-6 py-2.5 bg-fight-red text-white font-mono-data text-xs font-bold uppercase tracking-wider hover:bg-fight-red-hover"
              >
                Tutup Artikel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
