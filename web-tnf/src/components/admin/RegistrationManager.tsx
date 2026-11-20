"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RegistrationRow {
  id: string;
  code: string;
  fullName: string;
  ringName: string;
  address: string;
  age: number;
  divisionLabel: string;
  weightClassName: string | null;
  rules: string;
  competitionClass: string;
  bpjsStatus: string;
  socialUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  paymentAmount: number;
  paymentProof: { name: string | null; mime: string | null; url: string } | null;
  idDocument: { name: string | null; mime: string | null; url: string } | null;
  status: string;
  confirmedByName: string | null;
  confirmedAt: string | null;
  rejectionReason: string | null;
  reviewNotes: string | null;
  sheetRowNumber: number | null;
  sheetSyncedAt: string | null;
  sheetSyncError: string | null;
  createdAt: string;
}

interface Stats {
  pending: number;
  confirmed: number;
  rejected: number;
  total: number;
}

interface StatusMeta { label: string; badge: string; dot: string; icon: typeof Clock }

const STATUS_META: Record<string, StatusMeta> = {
  PENDING: {
    label: "Menunggu Konfirmasi",
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/40",
    dot: "bg-amber-500",
    icon: Clock,
  },
  CONFIRMED: {
    label: "Terkonfirmasi",
    badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Ditolak",
    badge: "bg-red-500/15 text-red-500 border-red-500/40",
    dot: "bg-red-500",
    icon: Ban,
  },
};

const RULES_LABEL: Record<string, string> = { BOXING: "Boxing", KICKBOXING: "Kickboxing" };
const CLASS_LABEL: Record<string, string> = { ATLET: "Atlet", PEMULA: "Pemula", NON_ATLET: "Non Atlet" };
const BPJS_LABEL: Record<string, string> = { AKTIF: "Aktif", TIDAK_AKTIF: "Tidak Aktif" };

function StatusBadge({ status }: { status: string }) {
  const meta: StatusMeta = STATUS_META[status] ?? STATUS_META.PENDING!;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono-data text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    amount,
  );
}

export function RegistrationManager({
  registrations,
  stats,
  canConfirm,
  sheetsConfigured,
}: {
  registrations: RegistrationRow[];
  stats: Stats;
  canConfirm: boolean;
  sheetsConfigured: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"ALL" | "PENDING" | "CONFIRMED" | "REJECTED">("ALL");
  const [query, setQuery] = React.useState("");
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [rejectFor, setRejectFor] = React.useState<RegistrationRow | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrations.filter((row) => {
      if (filter !== "ALL" && row.status !== filter) return false;
      if (!q) return true;
      return (
        row.fullName.toLowerCase().includes(q) ||
        row.ringName.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.divisionLabel.toLowerCase().includes(q)
      );
    });
  }, [registrations, filter, query]);

  const detail = registrations.find((row) => row.id === detailId) ?? null;

  async function act(id: string, body: Record<string, unknown>, successText: string) {
    setBusyId(id);
    setBanner(null);
    try {
      const response = await fetch(`/api/admin/registrations/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        setBanner({ kind: "err", text: payload?.error ?? "Aksi gagal diproses" });
        return false;
      }
      setBanner({ kind: "ok", text: successText });
      router.refresh();
      return true;
    } catch {
      setBanner({ kind: "err", text: "Koneksi gagal. Coba lagi." });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-ink">
            Pendaftaran Fighter
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Verifikasi pendaftar dari form publik. Baris terkirim otomatis ke Google Sheet{" "}
            <span className="text-ink">TFN x PIMPOM</span>.
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 border px-2.5 py-1 font-mono-data text-[10px] font-bold uppercase ${
            sheetsConfigured
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
              : "border-amber-500/40 bg-amber-500/10 text-amber-500"
          }`}
        >
          <RefreshCw className="h-3 w-3" />
          {sheetsConfigured ? "Google Sheets Aktif" : "Google Sheets Nonaktif"}
        </span>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Pendaftar", value: stats.total, tone: "text-ink", border: "border-border-subtle" },
          { label: "Menunggu", value: stats.pending, tone: "text-amber-500", border: "border-amber-500/40" },
          { label: "Terkonfirmasi", value: stats.confirmed, tone: "text-emerald-500", border: "border-emerald-500/40" },
          { label: "Ditolak", value: stats.rejected, tone: "text-red-500", border: "border-red-500/40" },
        ].map((card) => (
          <div key={card.label} className={`border ${card.border} bg-surface px-4 py-3`}>
            <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">{card.label}</p>
            <p className={`mt-1 font-display text-2xl font-black ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {banner && (
        <div
          className={`flex items-start justify-between gap-3 border px-4 py-3 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
              : "border-red-500/50 bg-red-500/10 text-red-500"
          }`}
        >
          <span className="flex items-center gap-2">
            {banner.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {banner.text}
          </span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Tutup notifikasi">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["ALL", `Semua (${stats.total})`],
              ["PENDING", `Menunggu (${stats.pending})`],
              ["CONFIRMED", `Terkonfirmasi (${stats.confirmed})`],
              ["REJECTED", `Ditolak (${stats.rejected})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`border px-3 py-1.5 font-mono-data text-[11px] font-bold uppercase transition-colors ${
                filter === key
                  ? "border-fight-red bg-fight-red/10 text-fight-red"
                  : "border-border-subtle text-ink-muted hover:border-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, nama fighter, kode…"
            className="w-full border border-border-subtle bg-canvas py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border-subtle bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-canvas-deep text-left font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">
              <th className="px-4 py-2.5">Pendaftar</th>
              <th className="px-4 py-2.5">Divisi / Rules</th>
              <th className="px-4 py-2.5">Kelas</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Masuk</th>
              <th className="px-4 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-ink-muted">
                  Belum ada pendaftaran pada filter ini.
                </td>
              </tr>
            )}
            {filtered.map((row) => {
              const meta: StatusMeta = STATUS_META[row.status] ?? STATUS_META.PENDING!;
              return (
                <tr key={row.id} className="border-b border-border-subtle/60 last:border-0 hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-ink">
                          {row.ringName}
                          <span className="ml-1.5 font-mono-data text-[10px] font-normal text-ink-subtle">
                            {row.code}
                          </span>
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {row.fullName} · {row.age} th
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-ink">{row.divisionLabel}</p>
                    <p className="font-mono-data text-[10px] uppercase text-ink-muted">{RULES_LABEL[row.rules] ?? row.rules}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-ink">{CLASS_LABEL[row.competitionClass] ?? row.competitionClass}</p>
                    <p className="font-mono-data text-[10px] uppercase text-ink-muted">
                      BPJS: {BPJS_LABEL[row.bpjsStatus] ?? row.bpjsStatus}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                    {row.sheetSyncError && (
                      <p className="mt-1 flex items-center gap-1 font-mono-data text-[10px] text-amber-500">
                        <AlertTriangle className="h-3 w-3" /> sheet gagal
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono-data text-[11px] text-ink-muted">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="dark" size="sm" onClick={() => setDetailId(row.id)}>
                        Detail
                      </Button>
                      {canConfirm && row.status !== "CONFIRMED" && (
                        <Button
                          variant="crimson"
                          size="sm"
                          disabled={busyId === row.id}
                          onClick={() => act(row.id, { action: "confirm" }, `${row.code} dikonfirmasi`)}
                        >
                          {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Konfirmasi"}
                        </Button>
                      )}
                      {canConfirm && row.status !== "REJECTED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRejectFor(row);
                            setRejectReason("");
                          }}
                        >
                          Tolak
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setDetailId(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l border-border-subtle bg-surface"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Detail pendaftaran ${detail.code}`}
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border-subtle bg-surface px-5 py-4">
              <div>
                <StatusBadge status={detail.status} />
                <h2 className="mt-1.5 font-display text-xl font-black uppercase text-ink">{detail.ringName}</h2>
                <p className="font-mono-data text-[11px] text-ink-muted">
                  {detail.code} · masuk {formatDateTime(detail.createdAt)}
                </p>
              </div>
              <button type="button" onClick={() => setDetailId(null)} aria-label="Tutup detail">
                <X className="h-5 w-5 text-ink-muted hover:text-ink" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 text-sm">
              <section className="grid grid-cols-2 gap-3">
                {[
                  ["Nama Lengkap", detail.fullName],
                  ["Usia", `${detail.age} tahun`],
                  ["Divisi", detail.divisionLabel],
                  ["Kategori Rules", RULES_LABEL[detail.rules] ?? detail.rules],
                  ["Kelas", CLASS_LABEL[detail.competitionClass] ?? detail.competitionClass],
                  ["BPJS", BPJS_LABEL[detail.bpjsStatus] ?? detail.bpjsStatus],
                  ["Biaya", formatIdr(detail.paymentAmount)],
                  ["Weight Class DB", detail.weightClassName ?? "tidak dipetakan"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">{label}</p>
                    <p className="text-ink">{value}</p>
                  </div>
                ))}
              </section>

              <section>
                <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Alamat</p>
                <p className="whitespace-pre-line text-ink">{detail.address}</p>
              </section>

              <section className="space-y-2">
                <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Lampiran</p>
                {[
                  { key: "payment", label: "Bukti Transfer", file: detail.paymentProof },
                  { key: "id", label: "KTP / Kartu Keluarga", file: detail.idDocument },
                ].map(({ key, label, file }) => (
                  <div key={key} className="flex items-center justify-between gap-3 border border-border-subtle bg-canvas px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-fight-red" />
                      <div className="min-w-0">
                        <p className="text-xs text-ink">{label}</p>
                        <p className="truncate font-mono-data text-[10px] text-ink-muted">{file?.name ?? "tidak ada"}</p>
                      </div>
                    </div>
                    {file && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 font-mono-data text-[10px] font-bold uppercase text-fight-red hover:underline"
                      >
                        Buka <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </section>

              <section className="space-y-1.5">
                <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Sosial Media</p>
                {[
                  ["Utama", detail.socialUrl],
                  ["Instagram", detail.instagramUrl],
                  ["TikTok", detail.tiktokUrl],
                  ["Facebook", detail.facebookUrl],
                  ["X / Twitter", detail.xUrl],
                ]
                  .filter(([, url]) => Boolean(url))
                  .map(([label, url]) => (
                    <a
                      key={label}
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-fight-red hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> {label}: {url}
                    </a>
                  ))}
                {!detail.socialUrl && !detail.instagramUrl && !detail.tiktokUrl && !detail.facebookUrl && !detail.xUrl && (
                  <p className="text-xs text-ink-muted">Tidak diisi.</p>
                )}
              </section>

              <section className="space-y-1.5 border border-border-subtle bg-canvas px-3 py-2.5">
                <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Google Sheet</p>
                <p className="text-xs text-ink-muted">
                  Baris: <span className="text-ink">{detail.sheetRowNumber ?? "belum tertulis"}</span> · Sinkron terakhir:{" "}
                  <span className="text-ink">{formatDateTime(detail.sheetSyncedAt)}</span>
                </p>
                {detail.sheetSyncError && (
                  <p className="break-words text-[11px] text-amber-500">{detail.sheetSyncError}</p>
                )}
                <Button
                  variant="dark"
                  size="sm"
                  disabled={busyId === detail.id}
                  onClick={() => act(detail.id, { action: "resync" }, "Sinkronisasi ulang berhasil")}
                >
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busyId === detail.id ? "animate-spin" : ""}`} />
                  Sync ulang
                </Button>
              </section>

              {detail.status !== "PENDING" && (
                <section className="border border-border-subtle bg-canvas px-3 py-2.5">
                  <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Riwayat Verifikasi</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink">
                    <User className="h-3 w-3" /> {detail.confirmedByName ?? "—"} · {formatDateTime(detail.confirmedAt)}
                  </p>
                  {detail.rejectionReason && (
                    <p className="mt-1 text-xs text-red-500">Alasan: {detail.rejectionReason}</p>
                  )}
                </section>
              )}

              {canConfirm && (
                <section className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row">
                  <Button
                    variant="crimson"
                    size="md"
                    className="flex-1"
                    disabled={busyId === detail.id || detail.status === "CONFIRMED"}
                    onClick={async () => {
                      const ok = await act(
                        detail.id,
                        { action: "confirm" },
                        `${detail.code} dikonfirmasi — status sheet diperbarui`,
                      );
                      if (ok) setDetailId(null);
                    }}
                  >
                    <ShieldCheck className="mr-1.5 h-4 w-4" /> Konfirmasi Peserta
                  </Button>
                  <Button
                    variant="dark"
                    size="md"
                    className="flex-1"
                    disabled={busyId === detail.id || detail.status === "REJECTED"}
                    onClick={() => {
                      setRejectFor(detail);
                      setRejectReason("");
                    }}
                  >
                    <Ban className="mr-1.5 h-4 w-4" /> Tolak
                  </Button>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {rejectFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border border-border-subtle bg-surface p-5" role="dialog" aria-modal="true">
            <h3 className="font-display text-lg font-black uppercase text-ink">Tolak Pendaftaran</h3>
            <p className="mt-1 text-xs text-ink-muted">
              {rejectFor.ringName} ({rejectFor.code}) akan ditandai <span className="text-red-500">Ditolak</span> dan
              baris sheet berubah merah.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Alasan penolakan (mis. bukti transfer tidak valid)"
              className="mt-3 w-full border border-border-subtle bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectFor(null)}>
                Batal
              </Button>
              <Button
                variant="crimson"
                size="sm"
                disabled={busyId === rejectFor.id || rejectReason.trim().length < 3}
                onClick={async () => {
                  const ok = await act(
                    rejectFor.id,
                    { action: "reject", reason: rejectReason.trim() },
                    `${rejectFor.code} ditolak`,
                  );
                  if (ok) {
                    setRejectFor(null);
                    setDetailId(null);
                  }
                }}
              >
                {busyId === rejectFor.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Tolak Pendaftaran"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
