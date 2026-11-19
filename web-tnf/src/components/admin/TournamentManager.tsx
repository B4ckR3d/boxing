"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  createTournamentAction,
  updateTournamentAction,
  toggleTournamentPublishAction,
  updateTournamentStatusAction,
  deleteTournamentAction,
} from "@/app/admin/(dashboard)/grand-prix/actions";

export interface TournamentItem {
  id: string;
  name: string;
  slug: string;
  weightClassId?: string;
  weightClassName: string;
  format: string;
  status: "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  size: number;
  prize: string | null;
  titleAwarded?: string | null;
  description?: string | null;
  startDate?: string | null;
  posterUrl: string | null;
  isPublished: boolean;
  participants: Array<{ id: string; fighterId?: string; seed: number; fighterName: string }>;
}

export interface SimpleWeightClass {
  id: string;
  name: string;
  gender: string;
}

export interface SimpleFighter {
  id: string;
  name: string;
  weightClassId: string;
  weightClassName: string;
}

export function TournamentManager({
  tournaments,
  weightClasses,
  fighters,
}: {
  tournaments: TournamentItem[];
  weightClasses: SimpleWeightClass[];
  fighters: SimpleFighter[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [weightClassId, setWeightClassId] = useState(weightClasses[0]?.id ?? "");
  const [format, setFormat] = useState<"SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION">("SINGLE_ELIMINATION");
  const [status, setStatus] = useState<"DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED">("REGISTRATION");
  const [size, setSize] = useState(8);
  const [prize, setPrize] = useState("");
  const [titleAwarded, setTitleAwarded] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [posterUrl, setPosterUrl] = useState("");
  const [posterId, setPosterId] = useState<string | undefined>(undefined);
  const [isPublished, setIsPublished] = useState(true);
  const [selectedFighters, setSelectedFighters] = useState<string[]>([]);

  const pool = fighters.filter((f) => !weightClassId || f.weightClassId === weightClassId);
  const fighterOptions = pool.length > 0 ? pool : fighters;

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setWeightClassId(weightClasses[0]?.id ?? "");
    setFormat("SINGLE_ELIMINATION");
    setStatus("REGISTRATION");
    setSize(8);
    setPrize("");
    setTitleAwarded("");
    setDescription("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setPosterUrl("");
    setPosterId(undefined);
    setIsPublished(true);
    setSelectedFighters([]);
    setIsModalOpen(true);
  };

  const openEditModal = (t: TournamentItem) => {
    setEditingId(t.id);
    setName(t.name);
    setWeightClassId(t.weightClassId || weightClasses[0]?.id || "");
    setFormat((t.format as "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION") || "SINGLE_ELIMINATION");
    setStatus((t.status as "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED") || "REGISTRATION");
    setSize(t.size || 8);
    setPrize(t.prize || "");
    setTitleAwarded(t.titleAwarded || "");
    setDescription(t.description || "");
    setStartDate(t.startDate || new Date().toISOString().slice(0, 10));
    setPosterUrl(t.posterUrl || "");
    setPosterId(undefined);
    setIsPublished(t.isPublished);
    setSelectedFighters(t.participants.map((p) => p.fighterId || "").filter(Boolean));
    setIsModalOpen(true);
  };

  const handleTogglePublish = (id: string, current: boolean) => {
    startTransition(async () => {
      const res = await toggleTournamentPublishAction(id, !current);
      if (res.ok) {
        toast.success(!current ? "Turnamen dipublikasikan (LIVE)!" : "Turnamen diubah ke DRAFT (Disembunyikan)!");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengubah status publikasi");
      }
    });
  };

  const toggleFighter = (id: string) => {
    setSelectedFighters((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= size) {
        toast.error(`Maksimal ${size} peserta sesuai ukuran bracket`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama turnamen wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = editingId
        ? await updateTournamentAction({
            id: editingId,
            name,
            weightClassId,
            format,
            status,
            size,
            prize: prize.trim() || undefined,
            titleAwarded: titleAwarded.trim() || undefined,
            description: description.trim() || undefined,
            posterId: posterId ?? (posterUrl ? undefined : null),
            startDate: startDate || undefined,
            isPublished,
            participantFighterIds: selectedFighters,
          })
        : await createTournamentAction({
            name,
            weightClassId,
            format,
            status,
            size,
            prize: prize.trim() || undefined,
            titleAwarded: titleAwarded.trim() || undefined,
            description: description.trim() || undefined,
            posterId: posterId ?? null,
            startDate: startDate || undefined,
            isPublished,
            participantFighterIds: selectedFighters,
          });

      if (res.ok) {
        toast.success(editingId ? "Turnamen Grand Prix berhasil diperbarui!" : "Turnamen Grand Prix berhasil dibuat!");
        setIsModalOpen(false);
        setEditingId(null);
        setName("");
        setPrize("");
        setTitleAwarded("");
        setDescription("");
        setPosterUrl("");
        setPosterId(undefined);
        setSelectedFighters([]);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyimpan turnamen");
      }
    });
  };

  const handleStatusChange = (
    id: string,
    nextStatus: "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  ) => {
    startTransition(async () => {
      const res = await updateTournamentStatusAction(id, nextStatus);
      if (res.ok) {
        toast.success("Status turnamen diperbarui");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengubah status turnamen");
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Hapus turnamen "${title}"?`)) return;
    startTransition(async () => {
      const res = await deleteTournamentAction(id);
      if (res.ok) {
        toast.success("Turnamen dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus turnamen");
      }
    });
  };

  return (
    <div className="space-y-6 text-ink select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="crimson">WORLD GRAND PRIX</Badge>
            <Badge variant="outline">BRACKET TOURNAMENT ENGINE</Badge>
          </div>
          <h1 className="font-display text-4xl text-ink uppercase">
            GRAND PRIX TOURNAMENT MANAGEMENT
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Konfigurasi turnamen eliminasi, unggah poster turnamen, atur peserta & seed bracket.
          </p>
        </div>

        <div>
          <Button variant="crimson" size="md" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" /> CREATE TOURNAMENT
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tournaments.map((t) => (
          <div
            key={t.id}
            className="bg-charcoal border-[3px] border-hard shadow-brutal-crimson overflow-hidden flex flex-col justify-between"
          >
            {t.posterUrl && (
              <div className="h-40 w-full bg-neutral-950 border-b border-subtle overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.posterUrl} alt={t.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <span className="font-display text-2xl text-ink uppercase truncate">{t.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleTogglePublish(t.id, t.isPublished)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono-data font-bold border cursor-pointer transition-colors ${
                        t.isPublished
                          ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-400 hover:bg-emerald-900/60"
                          : "bg-canvas border-subtle text-ink-muted hover:text-ink"
                      }`}
                      title={t.isPublished ? "Status: LIVE. Klik untuk ubah ke DRAFT" : "Status: DRAFT. Klik untuk PUBLIKASIKAN (LIVE)"}
                    >
                      {t.isPublished ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-ink-muted" />}
                      {t.isPublished ? "LIVE" : "DRAFT"}
                    </button>
                    <Badge variant={t.status === "IN_PROGRESS" ? "white" : "outline"}>
                      {t.status}
                    </Badge>
                  </div>
                </div>

                <p className="font-mono-data text-xs text-ink-muted mb-4">
                  DIVISION: {t.weightClassName} · FORMAT: {t.format.replace("_", " ")} ({t.size}-MAN BRACKET)
                </p>

                {t.prize && (
                  <div className="p-3 bg-canvas border border-fight-red mb-4 font-mono-data text-xs">
                    <span className="text-fight-red font-bold">PURSE / PRIZE:</span>{" "}
                    <span className="text-ink">{t.prize}</span>
                  </div>
                )}

                <div>
                  <p className="font-mono-data text-xs text-ink-muted font-bold uppercase tracking-wider mb-2 border-b border-subtle pb-1">
                    SEEDED PARTICIPANTS ({t.participants.length}/{t.size})
                  </p>
                  <div className="grid grid-cols-2 gap-2 font-mono-data text-xs">
                    {t.participants.map((p) => (
                      <div
                        key={p.id}
                        className="p-2 bg-canvas border border-subtle flex items-center justify-between"
                      >
                        <span className="text-ink font-medium truncate">{p.fighterName}</span>
                        <span className="font-bold text-fight-red text-[10px]">
                          SEED #{p.seed}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-subtle flex flex-wrap items-center justify-between gap-2 font-mono-data text-xs">
                <div className="flex items-center gap-2">
                  <select
                    value={t.status}
                    disabled={isPending}
                    onChange={(e) =>
                      handleStatusChange(
                        t.id,
                        e.target.value as
                          | "DRAFT"
                          | "REGISTRATION"
                          | "IN_PROGRESS"
                          | "COMPLETED"
                          | "CANCELLED",
                      )
                    }
                    className="bg-canvas border border-subtle px-2 py-1 text-[11px] text-ink"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="REGISTRATION">REGISTRATION</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => openEditModal(t)}
                    className="p-1.5 text-ink-muted hover:text-ink border border-subtle hover:border-fight-red transition-colors cursor-pointer"
                    title="Ubah Data Turnamen"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(t.id, t.name)}
                    className="p-1.5 text-ink-muted hover:text-fight-red border border-subtle hover:border-fight-red transition-colors cursor-pointer"
                    title="Hapus Turnamen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Link
                  href="/grand-prix"
                  target="_blank"
                  className="font-bold text-fight-red hover:underline"
                >
                  PUBLIC BRACKET →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Create Tournament */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-charcoal border-2 border-fight-red w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div>
                <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-widest block">
                  GRAND PRIX ENGINE
                </span>
                <h2 className="font-display text-2xl uppercase font-black text-ink">
                  {editingId ? "Ubah Data Turnamen Grand Prix" : "Buat Turnamen Grand Prix Baru"}
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

            <form onSubmit={handleSubmit} className="space-y-4 font-mono-data text-xs">
              <ImageUploader
                label="Upload Poster / Banner Turnamen (Opsional)"
                folder="tournaments"
                value={posterUrl}
                onChange={({ url, mediaAssetId }) => {
                  setPosterUrl(url);
                  setPosterId(mediaAssetId);
                }}
                disabled={isPending}
              />

              <div>
                <label className="block text-ink font-bold uppercase mb-1">Nama Turnamen *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: TFN Welterweight Grand Prix 2026"
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Divisi *</label>
                  <select
                    value={weightClassId}
                    onChange={(e) => {
                      setWeightClassId(e.target.value);
                      setSelectedFighters([]);
                    }}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  >
                    {weightClasses.map((wc) => (
                      <option key={wc.id} value={wc.id}>
                        {wc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Format</label>
                  <select
                    value={format}
                    onChange={(e) =>
                      setFormat(e.target.value as "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION")
                    }
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  >
                    <option value="SINGLE_ELIMINATION">Single Elimination</option>
                    <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Ukuran Bracket</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  >
                    <option value={4}>4 Petarung</option>
                    <option value={8}>8 Petarung</option>
                    <option value={16}>16 Petarung</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Total Hadiah / Purse</label>
                  <input
                    type="text"
                    value={prize}
                    onChange={(e) => setPrize(e.target.value)}
                    placeholder="Contoh: Rp 100.000.000 + Sabuk Emas"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Gelar yang Diperebutkan</label>
                  <input
                    type="text"
                    value={titleAwarded}
                    onChange={(e) => setTitleAwarded(e.target.value)}
                    placeholder="Contoh: TFN Grand Prix Champion"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED",
                      )
                    }
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  >
                    <option value="REGISTRATION">REGISTRATION (Pendaftaran)</option>
                    <option value="IN_PROGRESS">IN_PROGRESS (Berlangsung)</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">
                  Pilih Peserta Seeded ({selectedFighters.length}/{size})
                </label>
                <div className="max-h-36 overflow-y-auto border border-subtle bg-canvas p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {fighterOptions.map((f) => {
                    const seedIndex = selectedFighters.indexOf(f.id);
                    const isChecked = seedIndex !== -1;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFighter(f.id)}
                        className={`flex items-center justify-between px-2.5 py-1.5 text-left border transition-colors cursor-pointer ${
                          isChecked
                            ? "border-fight-red bg-fight-red/15 text-ink font-bold"
                            : "border-subtle text-ink-muted hover:text-ink"
                        }`}
                      >
                        <span className="truncate">{f.name}</span>
                        {isChecked && (
                          <span className="text-[10px] text-fight-red font-bold ml-2">
                            #{seedIndex + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Informasi singkat tentang format dan jadwal turnamen..."
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isTournamentPub"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="accent-fight-red w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isTournamentPub" className="text-ink font-bold cursor-pointer">
                  Langsung publikasikan ke halaman publik (/grand-prix)
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
                <Button type="submit" variant="crimson" disabled={isPending} className="font-bold tracking-wider">
                  {isPending ? "Menyimpan..." : editingId ? "Perbarui Turnamen" : "Buat Turnamen"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
