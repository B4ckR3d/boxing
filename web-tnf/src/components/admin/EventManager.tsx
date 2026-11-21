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
  Pencil,
  Ticket,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  createEventAction,
  updateEventAction,
  togglePublishEventAction,
  deleteEventAction,
  type TicketTypeInput,
} from "@/app/admin/(dashboard)/events/actions";

export interface TicketTypeItem {
  id?: string;
  name: string;
  price: number;
  quota: number;
  description?: string | null;
}

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
  posterId?: string | null;
  posterUrl?: string | null;
  fightsCount: number;
  ticketTypes?: TicketTypeItem[];
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
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [venue, setVenue] = useState("Gedung Pemuda Temanggung");
  const [city, setCity] = useState("Temanggung");
  const [startsAt, setStartsAt] = useState("2026-12-24T19:00");
  const [status, setStatus] = useState<"DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED">("SCHEDULED");
  const [isPublished, setIsPublished] = useState(true);
  const [description, setDescription] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [posterId, setPosterId] = useState<string | undefined>(undefined);

  // Ticket Categories State
  const [ticketTypes, setTicketTypes] = useState<TicketTypeInput[]>([
    { name: "VIP Ring Side", price: 250000, quota: 100, description: "Akses baris terdepan pinggir ring & snack" },
    { name: "Tribun Barat", price: 100000, quota: 300, description: "Tempat duduk berjenjang dengan pandangan jelas ke arena" },
    { name: "Festival", price: 50000, quota: 500, description: "Area berdiri festival umum" },
  ]);

  const openCreateModal = () => {
    setEditingEvent(null);
    setName("");
    setSlug("");
    setVenue("Gedung Pemuda Temanggung");
    setCity("Temanggung");
    setStartsAt("2026-12-24T19:00");
    setStatus("SCHEDULED");
    setIsPublished(true);
    setDescription("");
    setPosterUrl("");
    setPosterId(undefined);
    setTicketTypes([
      { name: "VIP Ring Side", price: 250000, quota: 100, description: "Akses baris terdepan pinggir ring & snack" },
      { name: "Tribun", price: 100000, quota: 300, description: "Tempat duduk tribun dengan view jelas ke ring" },
      { name: "Festival", price: 50000, quota: 500, description: "Area festival penonton umum" },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (evt: EventItem) => {
    setEditingEvent(evt);
    setName(evt.name);
    setSlug(evt.slug);
    setVenue(evt.venue || "Gedung Pemuda Temanggung");
    setCity(evt.city || "Temanggung");

    // Format ISO string to datetime-local input (YYYY-MM-DDTHH:mm)
    const d = new Date(evt.startsAt);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setStartsAt(localIso);

    setStatus((evt.status as any) || "SCHEDULED");
    setIsPublished(evt.isPublished);
    setDescription(evt.description || "");
    setPosterUrl(evt.posterUrl || "");
    setPosterId(evt.posterId || undefined);

    if (evt.ticketTypes && evt.ticketTypes.length > 0) {
      setTicketTypes(
        evt.ticketTypes.map((tt) => ({
          id: tt.id,
          name: tt.name,
          price: tt.price,
          quota: tt.quota,
          description: tt.description || "",
        }))
      );
    } else {
      setTicketTypes([
        { name: "VIP Ring Side", price: 250000, quota: 100, description: "Akses baris terdepan pinggir ring" },
        { name: "Festival", price: 50000, quota: 500, description: "Area berdiri festival umum" },
      ]);
    }
    setIsModalOpen(true);
  };

  const handleAddTicketType = () => {
    setTicketTypes([
      ...ticketTypes,
      { name: "", price: 50000, quota: 100, description: "" },
    ]);
  };

  const handleRemoveTicketType = (index: number) => {
    setTicketTypes(ticketTypes.filter((_, i) => i !== index));
  };

  const handleTicketChange = (index: number, field: keyof TicketTypeInput, value: any) => {
    const updated = [...ticketTypes];
    const current = updated[index];
    if (!current) return;
    updated[index] = { ...current, [field]: value } as TicketTypeInput;
    setTicketTypes(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama event wajib diisi");
      return;
    }

    startTransition(async () => {
      const validTickets = ticketTypes
        .filter((t) => t.name.trim().length > 0)
        .map((t) => ({
          ...t,
          price: Number(t.price) || 0,
          quota: Number(t.quota) || 100,
        }));

      if (editingEvent) {
        const res = await updateEventAction({
          id: editingEvent.id,
          name,
          slug: slug.trim() || undefined,
          venue,
          city,
          startsAt: new Date(startsAt).toISOString(),
          status,
          isPublished,
          description: description.trim() || undefined,
          posterId,
          ticketTypes: validTickets,
        });

        if (res.ok) {
          toast.success("Event dan kategori tiket berhasil diperbarui!");
          setIsModalOpen(false);
          setEditingEvent(null);
          router.refresh();
        } else {
          toast.error(res.error || "Gagal memperbarui event");
        }
      } else {
        const res = await createEventAction({
          name,
          slug: slug.trim() || undefined,
          venue,
          city,
          startsAt: new Date(startsAt).toISOString(),
          status,
          isPublished,
          description: description.trim() || undefined,
          posterId,
          ticketTypes: validTickets,
        });

        if (res.ok) {
          toast.success("Event baru dan kategori tiket berhasil ditambahkan!");
          setIsModalOpen(false);
          router.refresh();
        } else {
          toast.error(res.error || "Gagal membuat event");
        }
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

  const filteredEvents = events.filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.venue && e.venue.toLowerCase().includes(search.toLowerCase())) ||
      (e.city && e.city.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
            JADWAL EVENT & TIKET
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Kelola event pertandingan tinju, susunan laga (*fight card*), kategori harga tiket penonton, dan status tayang.
          </p>
        </div>

        {canManage && (
          <div>
            <Button
              variant="crimson"
              size="sm"
              onClick={openCreateModal}
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
              className={`px-2.5 py-1 uppercase font-bold text-[10px] border transition-colors cursor-pointer ${
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

            const ticketsCount = evt.ticketTypes?.length ?? 0;

            return (
              <div
                key={evt.id}
                className="bg-charcoal border border-subtle flex flex-col justify-between shadow-xl hover:border-fight-red transition-all group overflow-hidden"
              >
                {evt.posterUrl && (
                  <div className="h-40 w-full bg-neutral-950 border-b border-subtle overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={evt.posterUrl}
                      alt={evt.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <a
                      href={`/events/${evt.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-2.5 right-2.5 bg-black/75 hover:bg-fight-red text-white p-1.5 rounded text-xs transition-colors shadow"
                      title="Lihat Halaman Publik"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
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
                      <span>{evt.fightsCount} Laga Terjadwal</span>
                    </div>
                    <div className="flex items-center gap-2 text-ink">
                      <Ticket className="w-3.5 h-3.5 text-fight-red shrink-0" />
                      <span>
                        {ticketsCount > 0
                          ? `${ticketsCount} Kategori Tiket Dikonfigurasi`
                          : "Belum Ada Kategori Tiket"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                {canManage && (
                  <div className="p-3 bg-canvas border-t border-subtle flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => openEditModal(evt)}
                        className="inline-flex items-center gap-1.5 text-xs font-mono-data font-bold px-3 py-1 bg-surface border border-subtle text-ink hover:border-fight-red hover:text-fight-red transition-colors cursor-pointer"
                        title="Edit Data Event & Kategori Tiket"
                      >
                        <Pencil className="w-3 h-3 text-fight-red" />
                        <span>Edit Event</span>
                      </button>

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleTogglePublish(evt.id, evt.isPublished)}
                        className={`text-xs font-mono-data font-bold px-2.5 py-1 border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                          evt.isPublished
                            ? "border-subtle text-ink-muted hover:text-ink hover:bg-charcoal"
                            : "bg-fight-red border-fight-red text-ink hover:opacity-90"
                        }`}
                        title={evt.isPublished ? "Tarik dari halaman publik" : "Tayangkan ke publik"}
                      >
                        {evt.isPublished ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{evt.isPublished ? "Tarik" : "Publish"}</span>
                      </button>
                    </div>

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

      {/* Modal Tambah / Edit Event */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-charcoal border-2 border-fight-red w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div>
                <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-widest block">
                  {editingEvent ? "EDIT EVENT & TIKET" : "EVENT BARU TFN"}
                </span>
                <h2 className="font-display text-2xl uppercase font-black text-ink">
                  {editingEvent ? `Edit Event: ${editingEvent.name}` : "Tambah Event Baru"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-ink-muted hover:text-ink font-mono-data text-sm p-1 cursor-pointer"
              >
                ✕ TUTUP
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 font-mono-data text-xs">
              {/* Bagian 1: Informasi Dasar Event */}
              <div className="space-y-4">
                <div className="border-b border-subtle pb-1">
                  <span className="text-[11px] font-bold text-fight-red uppercase">
                    1. INFORMASI JADWAL & LOKASI
                  </span>
                </div>

                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Nama Event Pertandingan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: TFN 02 · NIGHT OF CHAMPIONS"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-ink font-bold uppercase mb-1">
                      Custom URL Slug (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="otomatis dari nama jika kosong"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
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
                          e.target.value as any
                        )
                      }
                      className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                    >
                      <option value="SCHEDULED">SCHEDULED (Terjadwal)</option>
                      <option value="LIVE">LIVE (Sedang Berlangsung)</option>
                      <option value="COMPLETED">COMPLETED (Selesai)</option>
                      <option value="DRAFT">DRAFT (Konsep / Arsip)</option>
                      <option value="POSTPONED">POSTPONED (Ditunda)</option>
                      <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-ink font-bold uppercase mb-1">
                      Tanggal & Jam (WIB) *
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

                <ImageUploader
                  label="Upload Poster Event (Drag & Drop)"
                  folder="events"
                  value={posterUrl}
                  onChange={({ url, mediaAssetId }) => {
                    setPosterUrl(url);
                    setPosterId(mediaAssetId);
                  }}
                  disabled={isPending}
                />

                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Deskripsi / Catatan Event
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan deskripsi lengkap pertandingan, perebutan sabuk, atau info acara..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
              </div>

              {/* Bagian 2: Kategori & Harga Tiket Event */}
              <div className="space-y-4 pt-4 border-t border-subtle">
                <div className="flex items-center justify-between border-b border-subtle pb-2">
                  <div>
                    <span className="text-[11px] font-bold text-fight-red uppercase block">
                      2. KATEGORI & HARGA TIKET PENONTON
                    </span>
                    <p className="text-[10px] text-ink-muted">
                      Kategori tiket ini akan muncul di halaman detail event (/events/[slug]). Pemesanan resmi diarahkan ke portal tiket.pimpom.id.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTicketType}
                    className="inline-flex items-center gap-1 bg-surface border border-subtle text-ink hover:text-fight-red px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-fight-red" />
                    <span>+ Tambah Tiket</span>
                  </button>
                </div>

                {ticketTypes.length === 0 ? (
                  <div className="bg-canvas/50 p-4 border border-subtle text-center text-ink-muted text-xs">
                    Belum ada kategori tiket. Klik "+ Tambah Tiket" untuk menambahkan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ticketTypes.map((tt, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-canvas border border-subtle space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] text-fight-red uppercase">
                            Kategori #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTicketType(idx)}
                            className="text-ink-muted hover:text-fight-red p-1 cursor-pointer"
                            title="Hapus Kategori Tiket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-5">
                            <label className="block text-[10px] text-ink-muted uppercase mb-0.5">
                              Nama Kategori *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="mis. VIP Ring Side, Tribun Barat"
                              value={tt.name}
                              onChange={(e) =>
                                handleTicketChange(idx, "name", e.target.value)
                              }
                              className="w-full bg-surface border border-subtle px-2 py-1 text-xs text-ink focus:border-fight-red focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <label className="block text-[10px] text-ink-muted uppercase mb-0.5">
                              Harga (Rp) *
                            </label>
                            <input
                              type="number"
                              required
                              min={0}
                              step={5000}
                              placeholder="mis. 150000"
                              value={tt.price}
                              onChange={(e) =>
                                handleTicketChange(
                                  idx,
                                  "price",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-surface border border-subtle px-2 py-1 text-xs text-ink focus:border-fight-red focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[10px] text-ink-muted uppercase mb-0.5">
                              Kuota Kursi
                            </label>
                            <input
                              type="number"
                              min={1}
                              placeholder="mis. 200"
                              value={tt.quota}
                              onChange={(e) =>
                                handleTicketChange(
                                  idx,
                                  "quota",
                                  parseInt(e.target.value, 10) || 100
                                )
                              }
                              className="w-full bg-surface border border-subtle px-2 py-1 text-xs text-ink focus:border-fight-red focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-ink-muted uppercase mb-0.5">
                            Fasilitas / Keterangan Singkat
                          </label>
                          <input
                            type="text"
                            placeholder="mis. Tempat duduk baris depan, free softdrink & lanyard resmi"
                            value={tt.description || ""}
                            onChange={(e) =>
                              handleTicketChange(idx, "description", e.target.value)
                            }
                            className="w-full bg-surface border border-subtle px-2 py-1 text-[11px] text-ink focus:border-fight-red focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Publikasi */}
              <div className="flex items-center gap-2 pt-2 border-t border-subtle">
                <input
                  type="checkbox"
                  id="isPub"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="accent-fight-red w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isPub" className="text-ink font-bold cursor-pointer">
                  Tayangkan ke Publik di Halaman `/events` dan `/events/[slug]`
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
                  {isPending
                    ? "Menyimpan..."
                    : editingEvent
                    ? "Simpan Perubahan Event"
                    : "Simpan & Buat Event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
