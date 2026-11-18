"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  createFighterAction,
  updateFighterAction,
  deleteFighterAction,
} from "@/app/admin/(dashboard)/fighters/actions";

export interface WeightClassOption {
  id: string;
  name: string;
  slug: string;
  gender: string;
}

export interface FighterItem {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  ringName: string | null;
  gender: "MALE" | "FEMALE";
  nationality: string;
  hometown: string | null;
  heightCm: number | null;
  reachCm: number | null;
  stance: "ORTHODOX" | "SOUTHPAW" | "SWITCH";
  weightClassId: string;
  weightClassName: string;
  weightClassSlug: string;
  status: "ACTIVE" | "INACTIVE" | "RETIRED" | "SUSPENDED";
  wins: number;
  losses: number;
  draws: number;
  koWins: number;
  bio: string | null;
  portraitId: string | null;
  portraitUrl: string | null;
  isChampion: boolean;
}

interface FormState {
  firstName: string;
  lastName: string;
  ringName: string;
  gender: "MALE" | "FEMALE";
  nationality: string;
  hometown: string;
  heightCm: string;
  reachCm: string;
  stance: "ORTHODOX" | "SOUTHPAW" | "SWITCH";
  weightClassId: string;
  status: "ACTIVE" | "INACTIVE" | "RETIRED" | "SUSPENDED";
  wins: number;
  losses: number;
  draws: number;
  koWins: number;
  bio: string;
  portraitUrl: string;
  portraitId: string | null | undefined;
}

export function FighterManager({
  fighters,
  weightClasses,
  canCreate,
  canUpdate,
  canDelete,
}: {
  fighters: FighterItem[];
  weightClasses: WeightClassOption[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const defaultWcId = weightClasses[0]?.id ?? "";

  const emptyForm = (): FormState => ({
    firstName: "",
    lastName: "",
    ringName: "",
    gender: "MALE",
    nationality: "ID",
    hometown: "",
    heightCm: "",
    reachCm: "",
    stance: "ORTHODOX",
    weightClassId: defaultWcId,
    status: "ACTIVE",
    wins: 0,
    losses: 0,
    draws: 0,
    koWins: 0,
    bio: "",
    portraitUrl: "",
    portraitId: undefined,
  });

  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fighters.filter((f) => {
      const matchSearch =
        !q ||
        `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) ||
        (f.ringName ?? "").toLowerCase().includes(q) ||
        f.weightClassName.toLowerCase().includes(q);
      const matchDiv = division === "ALL" || f.weightClassSlug === division;
      return matchSearch && matchDiv;
    });
  }, [fighters, search, division]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEdit = (f: FighterItem) => {
    setEditingId(f.id);
    setForm({
      firstName: f.firstName,
      lastName: f.lastName,
      ringName: f.ringName ?? "",
      gender: f.gender,
      nationality: f.nationality,
      hometown: f.hometown ?? "",
      heightCm: f.heightCm ? String(f.heightCm) : "",
      reachCm: f.reachCm ? String(f.reachCm) : "",
      stance: f.stance,
      weightClassId: f.weightClassId,
      status: f.status,
      wins: f.wins,
      losses: f.losses,
      draws: f.draws,
      koWins: f.koWins,
      bio: f.bio ?? "",
      portraitUrl: f.portraitUrl ?? "",
      portraitId: f.portraitId,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Nama depan dan belakang petarung wajib diisi");
      return;
    }
    if (!form.weightClassId) {
      toast.error("Pilih divisi kelas berat");
      return;
    }

    startTransition(async () => {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        ringName: form.ringName.trim() || undefined,
        gender: form.gender,
        nationality: form.nationality.trim() || "ID",
        hometown: form.hometown.trim() || undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : null,
        reachCm: form.reachCm ? Number(form.reachCm) : null,
        stance: form.stance,
        weightClassId: form.weightClassId,
        status: form.status,
        wins: Number(form.wins) || 0,
        losses: Number(form.losses) || 0,
        draws: Number(form.draws) || 0,
        koWins: Number(form.koWins) || 0,
        bio: form.bio.trim() || undefined,
        portraitId: form.portraitUrl ? form.portraitId : null,
      };

      const res = editingId
        ? await updateFighterAction(editingId, payload)
        : await createFighterAction(payload);

      if (res.ok) {
        toast.success(editingId ? "Data petarung diperbarui" : "Petarung baru berhasil didaftarkan!");
        setIsModalOpen(false);
        setEditingId(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyimpan data petarung");
      }
    });
  };

  const handleDelete = (f: FighterItem) => {
    if (!confirm(`Hapus petarung "${f.firstName} ${f.lastName}" dari roster aktif?`)) return;
    startTransition(async () => {
      const res = await deleteFighterAction(f.id);
      if (res.ok) {
        toast.success("Petarung dihapus dari roster");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus petarung");
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
              FIGHTER DATABASE
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {fighters.length} ATHLETES
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            ROSTER & ATHLETE MANAGEMENT
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Kelola data petarung terdaftar, foto profil, divisi kelas berat, dan rekor resmi.
          </p>
        </div>

        {canCreate && (
          <div>
            <Button variant="crimson" size="sm" onClick={openCreate} className="font-bold tracking-wider">
              <Plus className="w-4 h-4 mr-1.5" /> REGISTER FIGHTER
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-charcoal p-4 border border-subtle">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-canvas border border-subtle px-3 py-1.5">
          <Search className="w-4 h-4 text-ink-subtle" />
          <input
            type="text"
            placeholder="Cari nama petarung atau julukan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm font-mono-data text-ink outline-none placeholder:text-ink-subtle"
          />
        </div>

        <div className="flex flex-wrap gap-2 font-mono-data text-xs">
          <button
            type="button"
            onClick={() => setDivision("ALL")}
            className={`px-3 py-1.5 transition-colors font-bold uppercase cursor-pointer ${
              division === "ALL"
                ? "bg-fight-red text-ink"
                : "border border-subtle text-ink-muted hover:text-ink"
            }`}
          >
            ALL DIVISIONS
          </button>
          {weightClasses.slice(0, 5).map((wc) => (
            <button
              key={wc.id}
              type="button"
              onClick={() => setDivision(wc.slug)}
              className={`px-3 py-1.5 transition-colors font-bold uppercase cursor-pointer ${
                division === wc.slug
                  ? "bg-fight-red text-ink"
                  : "border border-subtle text-ink-muted hover:text-ink"
              }`}
            >
              {wc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Fighters Data Table */}
      <div className="bg-charcoal border border-subtle overflow-x-auto shadow-xl">
        <table className="w-full text-left font-sans text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-subtle bg-canvas font-display text-xs text-ink-muted uppercase tracking-wider">
              <th className="py-3 px-4">FIGHTER</th>
              <th className="py-3 px-4">DIVISION</th>
              <th className="py-3 px-4">RECORD</th>
              <th className="py-3 px-4">STANCE</th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/60">
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-surface-elevated transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-canvas border border-subtle overflow-hidden shrink-0 flex items-center justify-center">
                      {f.portraitUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.portraitUrl}
                          alt={`${f.firstName} ${f.lastName}`}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <User className="w-4 h-4 text-ink-subtle" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-data text-[10px] bg-surface-elevated text-ink px-1.5 py-0.5 border border-subtle font-bold">
                          {f.nationality}
                        </span>
                        <Link
                          href={`/fighters/${f.slug}`}
                          className="font-display text-base font-bold text-ink hover:text-fight-red transition-colors uppercase"
                        >
                          {f.firstName} {f.lastName}
                        </Link>
                        {f.isChampion && (
                          <span className="bg-fight-red text-ink font-mono-data text-[9px] font-bold px-1.5 py-0.5 uppercase">
                            CHAMPION
                          </span>
                        )}
                      </div>
                      {f.ringName && (
                        <span className="block font-mono-data text-[10px] text-fight-red font-bold uppercase">
                          &quot;{f.ringName}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                <td className="py-3.5 px-4 font-mono-data text-xs text-ink-muted">
                  {f.weightClassName}
                </td>

                <td className="py-3.5 px-4 font-mono-data text-xs font-bold text-ink">
                  {f.wins}-{f.losses}-{f.draws} ({f.koWins} KOs)
                </td>

                <td className="py-3.5 px-4 font-mono-data text-xs text-ink-muted">
                  {f.stance}
                </td>

                <td className="py-3.5 px-4">
                  <span
                    className={`inline-block font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 ${
                      f.status === "ACTIVE"
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                        : "bg-surface-elevated text-ink-muted border border-subtle"
                    }`}
                  >
                    {f.status}
                  </span>
                </td>

                <td className="py-3.5 px-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      href={`/fighters/${f.slug}`}
                      className="font-mono-data text-xs font-bold text-fight-red hover:underline"
                    >
                      Profil
                    </Link>
                    {canUpdate && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => openEdit(f)}
                        className="p-1.5 text-ink-muted hover:text-ink cursor-pointer"
                        title="Edit Petarung"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(f)}
                        className="p-1.5 text-ink-muted hover:text-fight-red cursor-pointer"
                        title="Hapus Petarung"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Register / Edit Fighter */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-charcoal border-2 border-fight-red w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div>
                <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-widest block">
                  FIGHTER ROSTER CMS
                </span>
                <h2 className="font-display text-2xl uppercase font-black text-ink">
                  {editingId ? "Edit Data Petarung" : "Daftarkan Petarung Baru"}
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
                label="Upload Foto Petarung (Opsional)"
                folder="fighters"
                value={form.portraitUrl}
                onChange={({ url, mediaAssetId }) =>
                  setForm({ ...form, portraitUrl: url, portraitId: mediaAssetId ?? null })
                }
                disabled={isPending}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Nama Depan *</label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="Contoh: Bima"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Nama Belakang *</label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Contoh: Prakoso"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Julukan / Ring Name</label>
                  <input
                    type="text"
                    value={form.ringName}
                    onChange={(e) => setForm({ ...form, ringName: e.target.value })}
                    placeholder="The Thunder"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Kode Negara (2 Huruf)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value.toUpperCase() })}
                    placeholder="ID"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Kota Asal</label>
                  <input
                    type="text"
                    value={form.hometown}
                    onChange={(e) => setForm({ ...form, hometown: e.target.value })}
                    placeholder="Temanggung"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Divisi Kelas Berat *</label>
                  <select
                    required
                    value={form.weightClassId}
                    onChange={(e) => setForm({ ...form, weightClassId: e.target.value })}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  >
                    {weightClasses.map((wc) => (
                      <option key={wc.id} value={wc.id}>
                        {wc.name} ({wc.gender})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as "MALE" | "FEMALE" })}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  >
                    <option value="MALE">MALE (Putra)</option>
                    <option value="FEMALE">FEMALE (Putri)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Stance</label>
                  <select
                    value={form.stance}
                    onChange={(e) =>
                      setForm({ ...form, stance: e.target.value as "ORTHODOX" | "SOUTHPAW" | "SWITCH" })
                    }
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  >
                    <option value="ORTHODOX">ORTHODOX</option>
                    <option value="SOUTHPAW">SOUTHPAW</option>
                    <option value="SWITCH">SWITCH</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Menang (W)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.wins}
                    onChange={(e) => setForm({ ...form, wins: Number(e.target.value) })}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Kalah (L)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.losses}
                    onChange={(e) => setForm({ ...form, losses: Number(e.target.value) })}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Seri (D)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.draws}
                    onChange={(e) => setForm({ ...form, draws: Number(e.target.value) })}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">KO Wins</label>
                  <input
                    type="number"
                    min={0}
                    value={form.koWins}
                    onChange={(e) => setForm({ ...form, koWins: Number(e.target.value) })}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Tinggi (cm)</label>
                  <input
                    type="number"
                    min={100}
                    max={250}
                    value={form.heightCm}
                    onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
                    placeholder="178"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Jangkauan / Reach (cm)</label>
                  <input
                    type="number"
                    min={100}
                    max={260}
                    value={form.reachCm}
                    onChange={(e) => setForm({ ...form, reachCm: e.target.value })}
                    placeholder="182"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as "ACTIVE" | "INACTIVE" | "RETIRED" | "SUSPENDED",
                      })
                    }
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="RETIRED">RETIRED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">Biografi Singkat</label>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Catatan profil atau gaya bertarung atlet..."
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
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
                  {isPending ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Daftarkan Petarung"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
