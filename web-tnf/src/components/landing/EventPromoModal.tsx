"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Ticket, ArrowUpRight, Calendar, Sparkles } from "lucide-react";

export interface EventPromoConfig {
  isEnabled?: boolean;
  badge?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export function EventPromoModal({ config }: { config?: EventPromoConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isFormPage = pathname?.startsWith("/daftar-fighter") ?? false;
  /**
   * Satu boolean dipakai sebagai dependency (bukan dua).
   * Jumlah entri dependency array WAJIB konstan antar-render — menambah/mengurangi
   * entri memicu error React "The final argument passed to useEffect changed size".
   */
  const promoAllowed = config?.isEnabled !== false && !isFormPage;
  const initialImg = config?.imageUrl || "/images/hero/boxing-ring-arena.jpg";
  const [imgSrc, setImgSrc] = useState(initialImg);

  useEffect(() => {
    setImgSrc(config?.imageUrl || "/images/hero/boxing-ring-arena.jpg");
  }, [config?.imageUrl]);

  useEffect(() => {
    // Dimatikan dari CMS atau sedang di halaman pendaftaran fighter → jangan tampilkan
    if (!promoAllowed) return;

    // Periksa apakah pengunjung sudah pernah menutup popup pada sesi browser ini
    try {
      const dismissed = sessionStorage.getItem("tfn_event_promo_dismissed");
      if (dismissed === "true") return;
    } catch {
      // Abaikan jika storage dinonaktifkan
    }

    // Munculkan popup dengan sedikit delay agar transisi mulus
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 700);

    return () => clearTimeout(timer);
  }, [promoAllowed]);

  // Tutup dengan tombol Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleDismiss = () => {
    setIsOpen(false);
    try {
      sessionStorage.setItem("tfn_event_promo_dismissed", "true");
    } catch {
      // Abaikan
    }
  };

  if (!isOpen || config?.isEnabled === false) return null;

  const badgeText = config?.badge || "LAGA MENDATANG · TIKET RESMI";
  const titleText = config?.title || "TEMANGGUNG FIGHT NIGHT VOL. 6";
  const subtitleText = config?.subtitle || "SABTU, 16 JANUARI 2027 · GOR BAMBU RUNCING";
  const descText =
    config?.description ||
    "Perebutan sabuk emas kelas berat & welter. Dapatkan tiket Anda sebelum kehabisan!";
  const btnLabel = config?.buttonLabel || "BELI TIKET SEKARANG";
  const targetUrl = config?.buttonUrl || "https://tiket.pimpom.id";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-event-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div className="relative w-full max-w-lg bg-charcoal border-2 border-fight-red shadow-[0_0_60px_rgba(230,0,0,0.35)] overflow-hidden text-ink animate-in zoom-in-95 duration-200">
        {/* Tombol Silang (Close Button) */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Tutup promo event"
          className="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-ink-muted hover:text-white hover:bg-fight-red border border-subtle transition-all focus:outline-none focus:ring-2 focus:ring-fight-red"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Gambar Flyer / Poster Acara */}
        <div className="relative h-56 sm:h-64 w-full bg-[#121216] overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={titleText}
            onError={() => setImgSrc("/images/hero/hero_fighter_5_champion.jpg")}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-transparent to-black/30 pointer-events-none" />

          {/* Badge Laga */}
          <div className="absolute top-3.5 left-3.5 bg-fight-red text-white font-mono-data text-[10px] font-bold tracking-widest uppercase px-3 py-1 shadow-md flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-white" />
            <span>{badgeText}</span>
          </div>
        </div>

        {/* Konten Deskripsi */}
        <div className="p-6 sm:p-7 space-y-4">
          <div>
            <h2
              id="promo-event-title"
              className="font-display text-2xl sm:text-3xl font-black uppercase text-ink leading-tight tracking-tight"
            >
              {titleText}
            </h2>
            <div className="flex items-center gap-2 mt-2 font-mono-data text-xs text-fight-red font-bold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>{subtitleText}</span>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-ink-muted">
            {descText}
          </p>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <Link
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDismiss}
              className="w-full inline-flex min-h-12 items-center justify-center gap-2.5 bg-fight-red hover:bg-fight-red-hover text-white font-bold uppercase tracking-wider text-sm shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] px-6 py-3"
            >
              <Ticket className="w-4 h-4" />
              <span>{btnLabel}</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full text-center py-2 text-xs font-mono-data uppercase tracking-wider text-ink-muted hover:text-ink transition-colors"
            >
              Nanti Saja / Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
