"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  createBeltAction,
  updateBeltAction,
  updateBeltHolderAction,
  deleteBeltAction,
} from "@/app/admin/(dashboard)/belts/actions";

export interface BeltItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  weightClassName: string;
  weightClassId: string;
  weightLimitLbs: string;
  description: string | null;
  sortOrder: number;
  imageAssetId: string | null;
  imageUrl: string | null;
  nextDefenseNote: string | null;
  activeReign: {
    id: string;
    fighterId: string;
    fighterName: string;
    ringName: string | null;
    wonAt: string;
    defensesCount: number;
  } | null;
  historicalReigns: Array<{
    id: string;
    fighterName: string;
    wonYear: string;
    endedYear: string;
  }>;
}

export interface SimpleWeightClass {
  id: string;
  name: string;
  limitLbs: string;
}

export interface SimpleFighter {
  id: string;
  name: string;
  weightClassId: string;
  weightClassName: string;
}

export function BeltManager({
  belts,
  weightClasses,
  fighters,
}: {
  belts: BeltItem[];
  weightClasses: SimpleWeightClass[];
  fighters: SimpleFighter[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // null = mode buat baru, string = id sabuk yang sedang diedit
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [weightClassId, setWeightClassId] = useState(weightClasses[0]?.id ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "VACANT">("VACANT");
  const [holderFighterId, setHolderFighterId] = useState("");
  const [wonAt, setWonAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [nextDefenseNote, setNextDefenseNote] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageId, setImageId] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState(belts.length);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama sabuk wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = editingId
        ? await updateBeltAction({
            id: editingId,
            name,
            weightClassId,
            description: description.trim() || undefined,
            imageId: imageId ?? null,
            nextDefenseNote: nextDefenseNote.trim() || undefined,
            sortOrder: Number(sortOrder) || 0,
          })
        : await createBeltAction({
            name,
            weightClassId,
            status: holderFighterId ? "ACTIVE" : status,
            holderFighterId: holderFighterId || undefined,
            wonAt: holderFighterId ? wonAt : undefined,
            nextDefenseNote: nextDefenseNote.trim() || undefined,
            description: description.trim() || undefined,
            imageId: imageId ?? null,
            sortOrder: Number(sortOrder) || 0,
          });

      if (res.ok) {
        toast.success(editingId ? "Sabuk kejuaraan berhasil diperbarui!" : "Sabuk kejuaraan baru berhasil dibuat!");
        setIsModalOpen(false);
        setEditingId(null);
        setName("");
        setHolderFighterId("");
        setNextDefenseNote("");
        setDescription("");
        setImageUrl("");
        setImageId(undefined);
        router.refresh();
      } else {
        toast.error(res.error || (editingId ? "Gagal memperbarui sabuk" : "Gagal membuat sabuk"));
      }
    });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setHolderFighterId("");
    setNextDefenseNote("");
    setDescription("");
    setImageUrl("");
    setImageId(undefined);
    setSortOrder(belts.length);
    setWeightClassId(weightClasses[0]?.id ?? "");
    setIsModalOpen(true);
  };

  const openEditModal = (belt: BeltItem) => {
    setEditingId(belt.id);
    setName(belt.name);
    setWeightClassId(belt.weightClassId);
    setNextDefenseNote(belt.nextDefenseNote ?? "");
    setDescription(belt.description ?? "");
    setImageUrl(belt.imageUrl ?? "");
    setImageId(belt.imageAssetId ?? undefined);
    setSortOrder(belt.sortOrder);
    setHolderFighterId("");
    setIsModalOpen(true);
  };

  const handleHolderChange = (beltId: string, newFighterId: string) => {
    startTransition(async () => {
      const res = await updateBeltHolderAction(beltId, newFighterId || null);
      if (res.ok) {
        toast.success(newFighterId ? "Pemegang sabuk diperbarui" : "Status sabuk diubah menjadi Vacant");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal memperbarui pemegang sabuk");
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Hapus sabuk "${title}"?`)) return;
    startTransition(async () => {
      const res = await deleteBeltAction(id);
      if (res.ok) {
        toast.success("Sabuk dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus sabuk");
      }
    });
  };

  return (
    <div className="space-y-6 text-ink select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              SANCTIONED TITLES
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {belts.length} WORLD BELTS
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            CHAMPIONSHIP BELT LINEAGE
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Kelola sabuk kejuaraan per divisi, unggah foto sabuk, dan tetapkan juara pemegang gelar.
          </p>
        </div>

        <div>
          <Button
            variant="crimson"
            size="sm"
            onClick={openCreateModal}
            className="font-bold tracking-wider"
          >
            <Plus className="w-4 h-4 mr-1.5" /> CREATE NEW DIVISION BELT
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {belts.map((belt) => (
          <div
            key={belt.id}
            className="bg-charcoal border border-subtle overflow-hidden flex flex-col justify-between shadow-xl"
          >
            {belt.imageUrl && (
              <div className="h-36 w-full bg-neutral-950 border-b border-subtle flex items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={belt.imageUrl}
                  alt={belt.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}

            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <span className="font-display text-2xl text-ink font-bold uppercase">
                    {belt.name}
                  </span>
                  <span
                    className={`font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 ${
                      belt.status === "ACTIVE"
                        ? "bg-fight-red text-ink"
                        : "bg-surface-elevated text-ink-muted"
                    }`}
                  >
                    {belt.status}
                  </span>
                </div>

                <p className="font-mono-data text-xs text-ink-muted mb-4">
                  DIVISION: {belt.weightClassName} ({belt.weightLimitLbs} LBS)
                </p>

                <div className="bg-canvas border-l-4 border-fight-red p-4 mb-4">
                  <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-wider block">
                    CURRENT TITLE HOLDER
                  </span>
                  {belt.activeReign ? (
                    <div className="mt-1">
                      <p className="font-display text-2xl text-ink font-black uppercase">
                        {belt.activeReign.fighterName}
                        {belt.activeReign.ringName ? ` "${belt.activeReign.ringName}"` : ""}
                      </p>
                      <p className="font-mono-data text-xs text-ink-muted mt-0.5">
                        Won on: {new Date(belt.activeReign.wonAt).toLocaleDateString("id-ID")} · Defenses:{" "}
                        {belt.activeReign.defensesCount}
                      </p>
                    </div>
                  ) : (
                    <p className="font-display text-2xl text-ink-muted mt-1 uppercase">
                      TITLE VACANT
                    </p>
                  )}

                  <div className="mt-3 pt-2 border-t border-subtle flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-fight-red shrink-0" />
                    <select
                      value={belt.activeReign?.fighterId ?? ""}
                      disabled={isPending}
                      onChange={(e) => handleHolderChange(belt.id, e.target.value)}
                      className="flex-1 bg-charcoal border border-subtle px-2 py-1 text-[11px] font-mono-data text-ink"
                    >
                      <option value="">-- Kosongkan Gelar (Vacant) --</option>
                      {fighters.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.weightClassName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-mono-data text-[10px] text-ink-muted font-bold uppercase tracking-wider block">
                    PAST REIGNS & DEFENSES ({belt.historicalReigns.length})
                  </span>
                  {belt.historicalReigns.length === 0 ? (
                    <p className="font-mono-data text-xs text-ink-subtle italic">
                      Belum ada riwayat pemegang sabuk sebelumnya.
                    </p>
                  ) : (
                    belt.historicalReigns.map((hr) => (
                      <div
                        key={hr.id}
                        className="flex items-center justify-between p-2 bg-canvas border border-subtle font-mono-data text-xs"
                      >
                        <span className="text-ink font-bold">{hr.fighterName}</span>
                        <span className="text-ink-subtle">
                          {hr.wonYear} - {hr.endedYear}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-subtle flex items-center justify-between gap-2 font-mono-data text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => openEditModal(belt)}
                    className="p-1.5 text-ink-muted hover:text-ink cursor-pointer"
                    title="Edit Sabuk"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(belt.id, belt.name)}
                    className="p-1.5 text-ink-muted hover:text-fight-red cursor-pointer"
                    title="Hapus Sabuk"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="text-ink-subtle truncate max-w-[200px]">
                    {belt.nextDefenseNote || "Mandatory Defense Pending"}
                  </span>
                </div>
                <Link href="/belts" className="text-fight-red hover:underline font-bold">
                  View 3D Belt →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Create Belt */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-charcoal border-2 border-fight-red w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div>
                <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-widest block">
                  SANCTIONED TITLES CMS
                </span>
                <h2 className="font-display text-2xl uppercase font-black text-ink">
                  {editingId ? "Edit Sabuk Kejuaraan" : "Buat Sabuk Kejuaraan Baru"}
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
                label="Upload Gambar Sabuk (Opsional)"
                folder="belts"
                value={imageUrl}
                onChange={({ url, mediaAssetId }) => {
                  setImageUrl(url);
                  setImageId(mediaAssetId);
                }}
                disabled={isPending}
              />

              <div>
                <label className="block text-ink font-bold uppercase mb-1">Nama Sabuk *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: TFN National Welterweight Championship"
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Divisi Kelas Berat *</label>
                  <select
                    value={weightClassId}
                    onChange={(e) => setWeightClassId(e.target.value)}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  >
                    {weightClasses.map((wc) => (
                      <option key={wc.id} value={wc.id}>
                        {wc.name} ({wc.limitLbs} LBS)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Urutan Tampil</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
              </div>

              {!editingId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    Pemegang Sabuk Saat Ini (Opsional)
                  </label>
                  <select
                    value={holderFighterId}
                    onChange={(e) => {
                      setHolderFighterId(e.target.value);
                      if (e.target.value) setStatus("ACTIVE");
                    }}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  >
                    <option value="">-- Vacant (Belum Ada Juara) --</option>
                    {fighters.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.weightClassName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">
                    {holderFighterId ? "Tanggal Meraih Gelar" : "Status Sabuk"}
                  </label>
                  {holderFighterId ? (
                    <input
                      type="date"
                      value={wonAt}
                      onChange={(e) => setWonAt(e.target.value)}
                      className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                    />
                  ) : (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "ACTIVE" | "VACANT")}
                      className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                    >
                      <option value="VACANT">VACANT</option>
                      <option value="ACTIVE">ACTIVE</option>
                    </select>
                  )}
                </div>
              </div>
              )}

              <div>
                <label className="block text-ink font-bold uppercase mb-1">
                  Catatan Pertahanan Wajib (Opsional)
                </label>
                <input
                  type="text"
                  value={nextDefenseNote}
                  onChange={(e) => setNextDefenseNote(e.target.value)}
                  placeholder="Contoh: Mandatory defense dijadwalkan di TFN 02"
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                />
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat tentang sejarah atau detail sabuk..."
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                />
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
                  {isPending ? "Menyimpan..." : editingId ? "SIMPAN PERUBAHAN" : "Buat Sabuk Kejuaraan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
