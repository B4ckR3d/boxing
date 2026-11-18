"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Plus, Trash2, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createRankingVersionAction,
  publishRankingVersionAction,
  deleteRankingVersionAction,
} from "@/app/admin/(dashboard)/rankings/actions";

export interface RankingVersionItem {
  id: string;
  type: string;
  versionNumber: number;
  status: string;
  effectiveDate: string;
  notes: string | null;
  weightClassName: string | null;
  gender: string | null;
  entries: Array<{
    id: string;
    rank: number | null;
    isChampion: boolean;
    points: number;
    fighterName: string;
    record: string;
  }>;
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
  record: string;
}

export function RankingManager({
  versions,
  weightClasses,
  fighters,
  canManage,
  canPublish,
}: {
  versions: RankingVersionItem[];
  weightClasses: SimpleWeightClass[];
  fighters: SimpleFighter[];
  canManage: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [type, setType] = useState<"DIVISION" | "POUND_FOR_POUND">("DIVISION");
  const [weightClassId, setWeightClassId] = useState(weightClasses[0]?.id ?? "");
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [championFighterId, setChampionFighterId] = useState("");
  const [contenders, setContenders] = useState<Array<{ fighterId: string; points: string }>>([
    { fighterId: "", points: "95" },
  ]);
  const [publishNow, setPublishNow] = useState(canPublish);

  const availableFighters =
    type === "DIVISION" && weightClassId
      ? fighters.filter((f) => f.weightClassId === weightClassId)
      : fighters;
  const fighterPool = availableFighters.length > 0 ? availableFighters : fighters;

  const addContenderRow = () => {
    setContenders((prev) => [...prev, { fighterId: "", points: String(Math.max(50, 95 - prev.length * 5)) }]);
  };

  const removeContenderRow = (idx: number) => {
    setContenders((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validContenders = contenders
      .filter((c) => c.fighterId)
      .map((c) => ({ fighterId: c.fighterId, points: c.points ? Number(c.points) : null }));

    if (!championFighterId && validContenders.length === 0) {
      toast.error("Pilih minimal 1 petarung (Juara atau Contender)");
      return;
    }

    startTransition(async () => {
      const res = await createRankingVersionAction({
        type,
        weightClassId: type === "DIVISION" ? weightClassId : undefined,
        gender: type === "POUND_FOR_POUND" ? gender : undefined,
        effectiveDate,
        notes: notes.trim() || undefined,
        championFighterId: championFighterId || undefined,
        contenders: validContenders,
        publishNow: canPublish ? publishNow : false,
      });

      if (res.ok) {
        toast.success(
          canPublish && publishNow
            ? "Peringkat baru berhasil dibuat dan dipublikasikan!"
            : "Draft peringkat baru berhasil disimpan!",
        );
        setIsModalOpen(false);
        setNotes("");
        setChampionFighterId("");
        setContenders([{ fighterId: "", points: "95" }]);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal membuat peringkat");
      }
    });
  };

  const handlePublish = (id: string) => {
    startTransition(async () => {
      const res = await publishRankingVersionAction(id);
      if (res.ok) {
        toast.success("Versi peringkat berhasil dipublikasikan!");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mempublikasikan peringkat");
      }
    });
  };

  const handleDelete = (id: string, label: string) => {
    if (!confirm(`Hapus versi peringkat "${label}"?`)) return;
    startTransition(async () => {
      const res = await deleteRankingVersionAction(id);
      if (res.ok) {
        toast.success("Versi peringkat dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus versi peringkat");
      }
    });
  };

  return (
    <div className="space-y-6 text-ink select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              SANCTIONING COMMITTEE
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              RATIFIED ENGINE
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            RANKINGS VERSIONING & PUBLICATION
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Kelola peringkat resmi per divisi dan Pound-for-Pound beserta histori versinya.
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
              <Plus className="w-4 h-4 mr-1.5" /> TAMBAH PERINGKAT BARU
            </Button>
          </div>
        )}
      </div>

      {/* Versions List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {versions.map((v) => {
          const champEntry = v.entries.find((e) => e.isChampion);
          const topEntries = v.entries.filter((e) => !e.isChampion).slice(0, 5);
          const title = v.weightClassName || `Pound-for-Pound (${v.gender || "ALL"})`;

          return (
            <div
              key={v.id}
              className="bg-charcoal border border-subtle p-6 flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-2xl text-ink font-bold uppercase">
                      {title}
                    </span>
                    <span className="font-mono-data text-xs text-fight-red font-bold">
                      v{v.versionNumber}.0
                    </span>
                  </div>

                  <span
                    className={`font-mono-data text-[10px] font-bold uppercase px-2 py-0.5 ${
                      v.status === "PUBLISHED"
                        ? "bg-fight-red text-ink"
                        : "bg-surface-elevated text-ink-muted border border-subtle"
                    }`}
                  >
                    {v.status === "PUBLISHED" ? "PUBLISHED · LIVE" : v.status}
                  </span>
                </div>

                <p className="font-mono-data text-xs text-ink-muted mb-4">
                  EFFECTIVE: {new Date(v.effectiveDate).toLocaleDateString("id-ID")} · {v.notes || "Official Committee Revision"}
                </p>

                {champEntry && (
                  <div className="bg-canvas border-l-4 border-fight-red p-3 mb-4 flex items-center justify-between">
                    <div>
                      <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-wider block">
                        WORLD CHAMPION
                      </span>
                      <span className="font-display text-xl text-ink font-black uppercase">
                        {champEntry.fighterName}
                      </span>
                    </div>
                    <Trophy className="w-5 h-5 text-fight-red" />
                  </div>
                )}

                <div className="space-y-1.5 font-mono-data text-xs">
                  {topEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-2 bg-canvas border border-subtle"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center font-bold text-ink-muted">
                          #{e.rank}
                        </span>
                        <span className="text-ink font-bold uppercase">
                          {e.fighterName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-ink-muted">
                        <span>{e.record}</span>
                        <span className="text-fight-red font-bold">{e.points.toFixed(1)} PTS</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-subtle flex items-center justify-between gap-2 font-mono-data text-xs">
                <div className="flex items-center gap-2">
                  {canPublish && v.status !== "PUBLISHED" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handlePublish(v.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-fight-red text-ink font-bold uppercase cursor-pointer hover:opacity-90"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Publikasikan
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(v.id, `${title} v${v.versionNumber}`)}
                      className="p-1.5 text-ink-muted hover:text-fight-red cursor-pointer"
                      title="Hapus Versi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Link href="/rankings" className="text-fight-red hover:underline font-bold">
                  View Public Table →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Tambah Peringkat */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-charcoal border-2 border-fight-red w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div>
                <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-widest block">
                  KOMITE PERINGKAT TFN
                </span>
                <h2 className="font-display text-2xl uppercase font-black text-ink">
                  Buat Versi Peringkat Baru
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Jenis Peringkat</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "DIVISION" | "POUND_FOR_POUND")}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  >
                    <option value="DIVISION">Divisi Kelas Berat</option>
                    <option value="POUND_FOR_POUND">Pound-for-Pound (P4P)</option>
                  </select>
                </div>

                {type === "DIVISION" ? (
                  <div>
                    <label className="block text-ink font-bold uppercase mb-1">Divisi *</label>
                    <select
                      value={weightClassId}
                      onChange={(e) => setWeightClassId(e.target.value)}
                      className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                    >
                      {weightClasses.map((wc) => (
                        <option key={wc.id} value={wc.id}>
                          {wc.name} ({wc.gender})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-ink font-bold uppercase mb-1">Gender P4P</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE")}
                      className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                    >
                      <option value="MALE">Putra (MALE)</option>
                      <option value="FEMALE">Putri (FEMALE)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Tanggal Efektif *</label>
                  <input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Catatan Revisi</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Update peringkat pasca TFN 01"
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">
                  Juara Bertahan / Champion (Opsional)
                </label>
                <select
                  value={championFighterId}
                  onChange={(e) => setChampionFighterId(e.target.value)}
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink"
                >
                  <option value="">-- Tidak ada / Vacant --</option>
                  {fighterPool.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.record}) — {f.weightClassName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-ink font-bold uppercase">
                    Daftar Penantang / Contenders
                  </label>
                  <button
                    type="button"
                    onClick={addContenderRow}
                    className="inline-flex items-center gap-1 px-2 py-1 border border-fight-red text-fight-red hover:bg-fight-red hover:text-ink font-bold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Tambah Baris
                  </button>
                </div>

                {contenders.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-8 text-center font-bold text-fight-red">#{idx + 1}</span>
                    <select
                      value={row.fighterId}
                      onChange={(e) => {
                        const next = [...contenders];
                        next[idx] = { ...row, fighterId: e.target.value };
                        setContenders(next);
                      }}
                      className="flex-1 bg-canvas border border-subtle px-2.5 py-2 text-ink"
                    >
                      <option value="">-- Pilih Petarung --</option>
                      {fighterPool.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.record})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.5"
                      value={row.points}
                      onChange={(e) => {
                        const next = [...contenders];
                        next[idx] = { ...row, points: e.target.value };
                        setContenders(next);
                      }}
                      placeholder="Poin"
                      className="w-24 bg-canvas border border-subtle px-2.5 py-2 text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => removeContenderRow(idx)}
                      className="p-2 text-ink-muted hover:text-fight-red cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {canPublish && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="publishRankingNow"
                    checked={publishNow}
                    onChange={(e) => setPublishNow(e.target.checked)}
                    className="accent-fight-red w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="publishRankingNow" className="text-ink font-bold cursor-pointer">
                    Langsung publikasikan ke halaman publik (/rankings)
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-subtle flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-subtle text-ink-muted hover:text-ink font-bold cursor-pointer"
                >
                  Batal
                </button>
                <Button type="submit" variant="crimson" disabled={isPending} className="font-bold tracking-wider">
                  {isPending ? "Menyimpan..." : "Simpan Peringkat"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
