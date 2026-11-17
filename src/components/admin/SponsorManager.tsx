"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Handshake, Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPONSOR_TIERS, sponsorTierLabel, type SponsorTierKey } from "@/lib/sponsors/tiers";
import {
  createSponsorAction,
  deleteSponsorAction,
  moveSponsorAction,
  toggleSponsorActiveAction,
  updateSponsorAction,
} from "@/app/admin/(dashboard)/sponsors/actions";

export interface SponsorItem {
  id: string;
  name: string;
  tier: SponsorTierKey;
  url: string | null;
  logoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
}

interface FormState {
  name: string;
  tier: string;
  url: string;
  logoUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  tier: "PLATINUM",
  url: "",
  logoUrl: "",
  sortOrder: 0,
  isActive: true,
};

const TIER_STYLE: Record<SponsorTierKey, string> = {
  PLATINUM: "bg-[#1C1C1C] border-[#B9C3CE] text-[#DCE3EA]",
  GOLD: "bg-[#1C1608] border-[#F5C542] text-[#F5C542]",
  SILVER: "bg-[#141414] border-[#9AA3AC] text-[#C9D1D8]",
  PARTNER: "bg-neutral-900 border-neutral-700 text-neutral-300",
  MEDIA_PARTNER: "bg-[#1A0E0E] border-fight-red text-fight-red",
};

export function SponsorManager({
  sponsors,
  canManage,
}: {
  sponsors: SponsorItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const activeCount = useMemo(() => sponsors.filter((s) => s.isActive).length, [sponsors]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: sponsors.length });
    setIsFormOpen(true);
  };

  const openEdit = (sponsor: SponsorItem) => {
    setEditingId(sponsor.id);
    setForm({
      name: sponsor.name,
      tier: sponsor.tier,
      url: sponsor.url ?? "",
      logoUrl: sponsor.logoUrl ?? "",
      sortOrder: sponsor.sortOrder,
      isActive: sponsor.isActive,
    });
    setIsFormOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama sponsor wajib diisi");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: form.name,
        tier: form.tier,
        url: form.url.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };

      const res = editingId
        ? await updateSponsorAction(editingId, payload)
        : await createSponsorAction(payload);

      if (res.ok) {
        toast.success(editingId ? "Sponsor berhasil diperbarui" : "Sponsor berhasil ditambahkan");
        setIsFormOpen(false);
        setEditingId(null);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyimpan sponsor");
      }
    });
  };

  const handleToggle = (sponsor: SponsorItem) => {
    startTransition(async () => {
      const res = await toggleSponsorActiveAction(sponsor.id);
      if (res.ok) {
        toast.success(sponsor.isActive ? "Sponsor disembunyikan dari beranda" : "Sponsor tampil di beranda");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal mengubah status sponsor");
      }
    });
  };

  const handleMove = (sponsor: SponsorItem, direction: "up" | "down") => {
    startTransition(async () => {
      const res = await moveSponsorAction(sponsor.id, direction);
      if (res.ok) router.refresh();
      else toast.error(res.error || "Gagal mengubah urutan");
    });
  };

  const handleDelete = (sponsor: SponsorItem) => {
    if (!confirm(`Hapus sponsor "${sponsor.name}"? Logo tidak akan tampil lagi di beranda.`)) return;
    startTransition(async () => {
      const res = await deleteSponsorAction(sponsor.id);
      if (res.ok) {
        toast.success("Sponsor berhasil dihapus");
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menghapus sponsor");
      }
    });
  };

  return (
    <div className="space-y-6 text-ink select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              SPONSORSHIP CMS
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {activeCount}/{sponsors.length} TAMPIL DI BERANDA
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            SPONSOR &amp; MITRA
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Kelola logo sponsor per tier. Hanya sponsor berstatus AKTIF yang dirender di beranda publik.
          </p>
        </div>

        {canManage && (
          <Button variant="crimson" size="sm" onClick={openCreate} className="font-bold tracking-wider">
            <Plus className="w-4 h-4 mr-1.5" /> TAMBAH SPONSOR
          </Button>
        )}
      </div>

      {sponsors.length === 0 ? (
        <div className="border border-subtle bg-charcoal p-12 text-center text-ink-muted">
          <Handshake className="w-10 h-10 mx-auto text-ink-subtle mb-3 opacity-40" />
          <p className="font-display text-xl uppercase font-bold">Belum ada sponsor terdaftar</p>
          <p className="font-mono-data text-xs mt-1">
            Beranda tidak menampilkan blok sponsor selama daftar kosong — tidak ada logo placeholder.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sponsors.map((sponsor, index) => (
            <div
              key={sponsor.id}
              className="bg-charcoal border border-subtle p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl hover:border-fight-red transition-all group"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-24 h-16 bg-white border border-subtle overflow-hidden shrink-0 flex items-center justify-center">
                  {sponsor.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sponsor.logoUrl} alt={`Logo ${sponsor.name}`} className="max-h-full max-w-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-neutral-400" />
                  )}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-mono-data text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${TIER_STYLE[sponsor.tier]}`}>
                      {sponsorTierLabel(sponsor.tier, "id")}
                    </span>
                    <span
                      className={`font-mono-data text-[9px] font-bold px-1.5 py-0.5 uppercase border ${
                        sponsor.isActive
                          ? "bg-emerald-950/60 border-emerald-600 text-emerald-400"
                          : "bg-neutral-900 border-neutral-700 text-neutral-400"
                      }`}
                    >
                      {sponsor.isActive ? "AKTIF" : "NONAKTIF"}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-black uppercase text-ink group-hover:text-fight-red transition-colors truncate">
                    {sponsor.name}
                  </h3>

                  <p className="font-mono-data text-[11px] text-ink-subtle truncate">
                    {sponsor.url || "tanpa tautan"} · urutan #{sponsor.sortOrder}
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center font-mono-data text-xs">
                  <button
                    type="button"
                    disabled={isPending || index === 0}
                    onClick={() => handleMove(sponsor, "up")}
                    className="p-2 text-ink-muted hover:text-ink disabled:opacity-25 transition-colors cursor-pointer"
                    title="Naikkan urutan"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isPending || index === sponsors.length - 1}
                    onClick={() => handleMove(sponsor, "down")}
                    className="p-2 text-ink-muted hover:text-ink disabled:opacity-25 transition-colors cursor-pointer"
                    title="Turunkan urutan"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggle(sponsor)}
                    className={`px-3 py-1.5 border font-bold uppercase transition-colors cursor-pointer ${
                      sponsor.isActive
                        ? "border-subtle text-ink-muted hover:text-ink hover:bg-canvas"
                        : "bg-fight-red border-fight-red text-ink hover:opacity-90"
                    }`}
                  >
                    {sponsor.isActive ? "Sembunyikan" : "Tampilkan"}
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => openEdit(sponsor)}
                    className="p-2 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                    title="Edit sponsor"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(sponsor)}
                    className="p-2 text-ink-muted hover:text-fight-red transition-colors cursor-pointer"
                    title="Hapus sponsor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-charcoal border-2 border-fight-red w-full max-w-lg shadow-2xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-subtle pb-3">
              <div>
                <span className="font-mono-data text-[10px] text-fight-red font-bold uppercase tracking-widest block">
                  CMS SPONSORSHIP
                </span>
                <h2 className="font-display text-2xl uppercase font-black text-ink">
                  {editingId ? "Edit Sponsor" : "Tambah Sponsor Baru"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-ink-muted hover:text-ink font-mono-data text-sm p-1"
              >
                ✕ TUTUP
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4 font-mono-data text-xs">
              <div>
                <label className="block text-ink font-bold uppercase mb-1">Nama Sponsor *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Bank Jateng"
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Tier</label>
                  <select
                    value={form.tier}
                    onChange={(e) => setForm({ ...form, tier: e.target.value })}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  >
                    {SPONSOR_TIERS.map((tier) => (
                      <option key={tier.key} value={tier.key}>
                        {tier.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ink font-bold uppercase mb-1">Urutan Tampil</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">Path / URL Logo</label>
                <input
                  type="text"
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  placeholder="/images/sponsors/bank-jateng.png"
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none text-[11px]"
                />
                <p className="text-[10px] text-ink-subtle mt-1">
                  Upload file ke <code>public/images/sponsors/</code> lalu tempel path-nya, atau pakai URL https.
                  Disarankan PNG transparan.
                </p>
              </div>

              <div>
                <label className="block text-ink font-bold uppercase mb-1">Situs Web Sponsor (opsional)</label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://sponsor.co.id"
                  className="w-full bg-canvas border border-subtle px-3 py-2 text-ink focus:border-fight-red focus:outline-none text-[11px]"
                />
              </div>

              {form.logoUrl.trim() && (
                <div className="border border-subtle bg-white p-3 flex items-center justify-center h-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoUrl} alt="Pratinjau logo" className="max-h-full max-w-full object-contain" />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isSponsorActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="accent-fight-red w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isSponsorActive" className="text-ink font-bold cursor-pointer">
                  Tampilkan logo di beranda publik
                </label>
              </div>

              <div className="pt-4 border-t border-subtle flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-subtle text-ink-muted hover:text-ink font-bold cursor-pointer"
                >
                  Batal
                </button>
                <Button type="submit" variant="crimson" disabled={isPending} className="font-bold tracking-wider">
                  {isPending ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Sponsor"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
