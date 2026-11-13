"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Plus,
  Search,
  Trash2,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createEventAction,
  togglePublishEventAction,
  deleteEventAction,
} from "@/app/admin/(dashboard)/events/actions";

export interface EventItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  startsAt: string | Date;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED" | string;
  isPublished: boolean;
  fightsCount: number;
}

export function EventManager({
  events,
  canManage,
}: {
  events: EventItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Event Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [venue, setVenue] = useState("Gedung Pemuda Temanggung");
  const [city, setCity] = useState("Temanggung");
  const [startsAt, setStartsAt] = useState("2026-12-24T19:00");
  const [status, setStatus] = useState<"DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED">("SCHEDULED");
  const [isPublished, setIsPublished] = useState(true);
  const [description, setDescription] = useState("");

  const filteredEvents = events.filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.venue && e.venue.toLowerCase().includes(search.toLowerCase())) ||
      (e.city && e.city.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama event wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await createEventAction({
        name,
        slug: slug.trim() || undefined,
        venue,
        city,
        startsAt: new Date(startsAt).toISOString(),
        status,
        isPublished,
        description: description.trim() || undefined,
      });

      if (res.ok) {
        toast.success("Event baru berhasil ditambahkan!");
        setIsModalOpen(false);
        setName("");
        setSlug("");
        setDescription("");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal membuat event");
      }
    });
  };

  const handleTogglePublish = (id: string, currentPublished: boolean) => {
    startTransition(async () => {
      const res = await togglePublishEventAction(id);
      if (res.ok) {
        toast.success(
          currentPublished ? "Event ditarik dari publikasi" : "Event berhasil dipublikasikan!"
        );
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengubah status publikasi");
      }
    });
  };

  const handleDelete = (id: string, eventName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus event "${eventName}"?`)) return;

    startTransition(async () => {
      const res = await deleteEventAction(id);
      if (res.ok) {
        toast.success("Event berhasil dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus event");
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
              MANAJEMEN EVENT TFN
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {events.length} TOTAL EVENT
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            JADWAL EVENT & FIGHT CARD
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Kelola kalender pertarungan resmi, jadwal laga tinju, venue pertandingan, dan status siaran langsung.
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
              <Plus className="w-4 h-4 mr-1.5" /> TAMBAH EVENT BARU
            </Button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-charcoal p-4 border border-subtle">
        <div className="flex items-center gap-2 flex-1 min-w-[260px] bg-canvas border border-subtle px-3 py-1.5">
          <Search className="w-4 h-4 text-ink-subtle" />
          <input
            type="text"
            placeholder="Cari event, venue, kota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none font-sans"
          />
        </div>

        <div className="flex items-center gap-2 font-mono-data text-xs">
          <span className="text-ink-muted uppercase">Status:</span>
          {["ALL", "SCHEDULED", "LIVE", "COMPLETED", "DRAFT"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 uppercase font-bold text-[10px] border transition-colors ${
                statusFilter === st
                  ? "bg-fight-red text-ink border-fight-red"
                  : "bg-canvas border-subtle text-ink-muted hover:text-ink"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Event Cards Grid */}
      {filteredEvents.length === 0 ? (
        <div className="border border-subtle bg-charcoal p-12 text-center text-ink-muted">
          <Calendar className="w-10 h-10 mx-auto text-ink-subtle mb-3 opacity-40" />
          <p className="font-display text-xl uppercase font-bold">Tidak ada event ditemukan</p>
          <p className="font-mono-data text-xs mt-1">Coba sesuaikan pencarian atau tambahkan event baru.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => {
            const dateObj = new Date(evt.startsAt);
            const dateFormatted = dateObj.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            const timeFormatted = dateObj.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={evt.id}
                className="bg-charcoal border border-subtle flex flex-col justify-between shadow-xl hover:border-fight-red transition-all group overflow-hidden"
              >
                <div className="p-5 space-y-4">
                  {/* Status & Badge Row */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono-data text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider ${
                        evt.status === "LIVE"
                          ? "bg-fight-red text-ink animate-pulse"
                          : evt.status === "SCHEDULED"
                          ? "bg-emerald-600 text-white"
                          : "bg-surface-elevated text-ink-muted border border-subtle"
                      }`}
                    >
                      {evt.status}
                    </span>

                    <span
                      className={`font-mono-data text-[10px] font-bold px-2 py-0.5 uppercase border ${
                        evt.isPublished
                          ? "bg-emerald-950/60 border-emerald-600 text-emerald-400"
                          : "bg-neutral-900 border-neutral-700 text-neutral-400"
                      }`}
                    >
                      {evt.isPublished ? "PUBLISHED" : "DRAFT"}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-display text-2xl font-black uppercase text-ink group-hover:text-fight-red transition-colors leading-tight">
                      {evt.name}
                    </h3>
                    {evt.description && (
                      <p className="font-sans text-xs text-ink-muted mt-2 line-clamp-2 leading-relaxed">
                        {evt.description}
                      </p>
                    )}
                  </div>

                  {/* Telemetry info */}
                  <div className="space-y-1.5 pt-2 border-t border-subtle font-mono-data text-xs text-ink-muted">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-fight-red shrink-0" />
                      <span>{dateFormatted} · {timeFormatted} WIB</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-ink-subtle shrink-0" />
                      <span className="truncate">{evt.venue || "Gedung Pemuda"}, {evt.city || "Temanggung"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Swords className="w-3.5 h-3.5 text-ink-subtle shrink-0" />
                      <span>{evt.fightsCount} Laga Pertarungan Terjadwal</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                {canManage && (
                  <div className="p-3 bg-canvas border-t border-subtle flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleTogglePublish(evt.id, evt.isPublished)}
                      className={`text-xs font-mono-data font-bold px-2.5 py-1 border transition-colors cursor-pointer ${
                        evt.isPublished
                          ? "border-subtle text-ink-muted hover:text-ink hover:bg-charcoal"
                          : "bg-fight-red border-fight-red text-ink hover:opacity-90"
                      }`}
                    >
                      {evt.isPublished ? "Tarik Publikasi" : "Publikasikan"}
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(evt.id, evt.name)}
                      className="p-1.5 text-ink-muted hover:text-fight-red transition-colors cursor-pointer"
                      title="Hapus Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah Event Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-charcoal border-2 border-fight-red w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div>
                <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-widest block">
                  KALENDER RESMI TFN
                </span>
                <h2 className="font-display text-2xl uppercase font-black text-ink">
                  Tambah Event Baru
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
                  Nama Event Pertandingan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TFN 02 · TEMANGGUNG FIGHT NIGHT"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Venue / Tempat
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Kota
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Tanggal & Waktu (WIB)
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Status Event
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED"
                      )
                    }
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  >
                    <option value="SCHEDULED">SCHEDULED (Terjadwal)</option>
                    <option value="LIVE">LIVE (Sedang Berlangsung)</option>
                    <option value="COMPLETED">COMPLETED (Selesai)</option>
                    <option value="DRAFT">DRAFT (Konsep)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">
                  Deskripsi / Catatan Event
                </label>
                <textarea
                  rows={3}
                  placeholder="Duel akbar perebutan sabuk dan babak penyisihan turnamen Grand Prix..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPub"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="accent-fight-red w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isPub" className="text-ink font-bold cursor-pointer">
                  Langsung Publikasikan ke Halaman Publik (/events)
                </label>
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
                  {isPending ? "Menyimpan..." : "Simpan & Buat Event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
