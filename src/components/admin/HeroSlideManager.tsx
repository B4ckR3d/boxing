"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sliders,
  Plus,
  Trash2,
  Calendar,
  ExternalLink,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createHeroSlideAction,
  toggleActiveHeroSlideAction,
  deleteHeroSlideAction,
} from "@/app/admin/(dashboard)/hero-slides/actions";

export interface HeroSlideItem {
  id: string;
  eventTitle: string;
  headline: string;
  description: string | null;
  eventDate: string | null;
  fighterImageUrl: string | null;
  backgroundImageUrl: string | null;
  ctaPrimaryLabel: string | null;
  ctaPrimaryHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function HeroSlideManager({
  slides,
  canManage,
}: {
  slides: HeroSlideItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Slide Form State
  const [eventTitle, setEventTitle] = useState("TFN 01 · GEDUNG PEMUDA TEMANGGUNG");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("2026-12-24T19:00");
  const [fighterImageUrl, setFighterImageUrl] = useState("/images/hero/hero_fighter_1_marcus.jpg");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("/images/hero/boxing-ring-arena.jpg");
  const [ctaPrimaryLabel, setCtaPrimaryLabel] = useState("BACA SELENGKAPNYA");
  const [ctaPrimaryHref, setCtaPrimaryHref] = useState("/events");
  const [ctaSecondaryLabel, setCtaSecondaryLabel] = useState("LIHAT FIGHT CARD");
  const [ctaSecondaryHref, setCtaSecondaryHref] = useState("/rankings");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      toast.error("Headline slide wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await createHeroSlideAction({
        eventTitle,
        headline,
        description: description.trim() || undefined,
        eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
        fighterImageUrl: fighterImageUrl.trim() || undefined,
        backgroundImageUrl: backgroundImageUrl.trim() || undefined,
        ctaPrimaryLabel,
        ctaPrimaryHref,
        ctaSecondaryLabel,
        ctaSecondaryHref,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      });

      if (res.ok) {
        toast.success("Hero slide baru berhasil ditambahkan!");
        setIsModalOpen(false);
        setHeadline("");
        setDescription("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal membuat hero slide");
      }
    });
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    startTransition(async () => {
      const res = await toggleActiveHeroSlideAction(id);
      if (res.ok) {
        toast.success(
          currentActive ? "Slide dinonaktifkan" : "Slide berhasil diaktifkan!"
        );
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengubah status slide");
      }
    });
  };

  const handleDelete = (id: string, slideHeadline: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus slide "${slideHeadline}"?`)) return;

    startTransition(async () => {
      const res = await deleteHeroSlideAction(id);
      if (res.ok) {
        toast.success("Slide berhasil dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus slide");
      }
    });
  };

  return (
    <div className="space-y-6 text-ink select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              LANDING PAGE CMS
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {slides.length} SLIDE TERDAFTAR
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            HERO BANNER & SLIDER
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Konfigurasi tayangan slide utama di halaman beranda publik, foto petarung hero, narasi laga, dan tombol ajakan aksi (CTA).
          </p>
        </div>

        {canManage && (
          <div>
            <Button
              variant="crimson"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="font-bold tracking-wider"
            >
              <Plus className="w-4 h-4 mr-1.5" /> TAMBAH SLIDE HERO
            </Button>
          </div>
        )}
      </div>

      {/* Slide Cards List */}
      {slides.length === 0 ? (
        <div className="border border-subtle bg-charcoal p-12 text-center text-ink-muted">
          <Sliders className="w-10 h-10 mx-auto text-ink-subtle mb-3 opacity-40" />
          <p className="font-display text-xl uppercase font-bold">Belum ada slide kustom di database</p>
          <p className="font-mono-data text-xs mt-1">
            Saat ini beranda menggunakan 5 slide petarung default. Klik &quot;TAMBAH SLIDE HERO&quot; untuk menambahkan banner baru!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {slides.map((s, idx) => (
            <div
              key={s.id}
              className="bg-charcoal border border-subtle p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl hover:border-fight-red transition-all group"
            >
              {/* Thumbnail & Info */}
              <div className="flex items-start sm:items-center gap-4 flex-1">
                <div className="w-20 h-20 bg-neutral-900 border border-subtle overflow-hidden shrink-0 relative flex items-center justify-center">
                  {s.fighterImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.fighterImageUrl}
                      alt={s.headline}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-ink-subtle opacity-40" />
                  )}
                  <span className="absolute top-1 left-1 bg-black/80 font-mono-data text-[9px] font-bold text-[#F5C542] px-1">
                    #{s.sortOrder}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-wider">
                      {s.eventTitle}
                    </span>
                    <span
                      className={`font-mono-data text-[9px] font-bold px-1.5 py-0.2 uppercase border ${
                        s.isActive
                          ? "bg-emerald-950/60 border-emerald-600 text-emerald-400"
                          : "bg-neutral-900 border-neutral-700 text-neutral-400"
                      }`}
                    >
                      {s.isActive ? "AKTIF" : "NONAKTIF"}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-black uppercase text-ink group-hover:text-fight-red transition-colors leading-tight">
                    {s.headline}
                  </h3>

                  {s.description && (
                    <p className="font-sans text-xs text-ink-muted line-clamp-1 max-w-xl">
                      {s.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 font-mono-data text-[11px] text-ink-subtle pt-1">
                    <span>CTA 1: {s.ctaPrimaryLabel || "N/A"} ({s.ctaPrimaryHref || "/"})</span>
                    <span>•</span>
                    <span>CTA 2: {s.ctaSecondaryLabel || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {canManage && (
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center font-mono-data text-xs">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleActive(s.id, s.isActive)}
                    className={`px-3 py-1.5 border font-bold uppercase transition-colors cursor-pointer ${
                      s.isActive
                        ? "border-subtle text-ink-muted hover:text-ink hover:bg-canvas"
                        : "bg-fight-red border-fight-red text-ink hover:opacity-90"
                    }`}
                  >
                    {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(s.id, s.headline)}
                    className="p-2 text-ink-muted hover:text-fight-red transition-colors cursor-pointer"
                    title="Hapus Slide"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah Slide Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-charcoal border-2 border-fight-red w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div>
                <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-widest block">
                  CMS HERO BANNER
                </span>
                <h2 className="font-display text-2xl uppercase font-black text-ink">
                  Tambah Slide Hero Baru
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-ink-muted hover:text-ink font-mono-data text-sm p-1"
              >
                ✕ TUTUP
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 font-mono-data text-xs">
              <div>
                <label className="block text-ink font-bold uppercase mb-1">
                  Sub-Judul / Label Venue Event
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Contoh: TFN 01 · GEDUNG PEMUDA TEMANGGUNG"
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">
                  Headline Utama (Judul Besar) *
                </label>
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Contoh: MARCUS VALE: SANG RAJA TAK TERKALAHKAN"
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">
                  Deskripsi Narasi Laga
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Marcus 'Iron' Vale mempertaruhkan rekor tak terkalahkannya dalam duel sengit 12 ronde..."
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Path / URL Foto Petarung
                  </label>
                  <input
                    type="text"
                    value={fighterImageUrl}
                    onChange={(e) => setFighterImageUrl(e.target.value)}
                    placeholder="/images/hero/hero_fighter_1_marcus.jpg"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Path / URL Background Arena
                  </label>
                  <input
                    type="text"
                    value={backgroundImageUrl}
                    onChange={(e) => setBackgroundImageUrl(e.target.value)}
                    placeholder="/images/hero/boxing-ring-arena.jpg"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Tombol Utama (Label & Link)
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={ctaPrimaryLabel}
                      onChange={(e) => setCtaPrimaryLabel(e.target.value)}
                      placeholder="Label: BACA SELENGKAPNYA"
                      className="w-full bg-canvas border border-subtle px-2 py-1.5 text-ink text-[11px]"
                    />
                    <input
                      type="text"
                      value={ctaPrimaryHref}
                      onChange={(e) => setCtaPrimaryHref(e.target.value)}
                      placeholder="Link: /events"
                      className="w-full bg-canvas border border-subtle px-2 py-1.5 text-ink text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Tombol Kedua (Label & Link)
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={ctaSecondaryLabel}
                      onChange={(e) => setCtaSecondaryLabel(e.target.value)}
                      placeholder="Label: LIHAT FIGHT CARD"
                      className="w-full bg-canvas border border-subtle px-2 py-1.5 text-ink text-[11px]"
                    />
                    <input
                      type="text"
                      value={ctaSecondaryHref}
                      onChange={(e) => setCtaSecondaryHref(e.target.value)}
                      placeholder="Link: /rankings"
                      className="w-full bg-canvas border border-subtle px-2 py-1.5 text-ink text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Urutan Tampil (Sort Order)
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isSlideActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="accent-fight-red w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="isSlideActive" className="text-ink font-bold cursor-pointer">
                    Aktifkan Slide di Beranda
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-subtle flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-subtle text-ink-muted hover:text-ink font-bold cursor-pointer"
                >
                  Batal
                </button>
                <Button
                  type="submit"
                  variant="crimson"
                  disabled={isPending}
                  className="font-bold tracking-wider"
                >
                  {isPending ? "Menyimpan..." : "Simpan & Publikasikan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

