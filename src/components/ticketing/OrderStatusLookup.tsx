"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Download, Ticket, XCircle, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { methodLabel, paymentStatusLabel } from "@/lib/ticketing/labels";
import { Button } from "@/components/ui/button";

export type OrderStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "USED" | "REJECTED" | "CANCELLED";

export type OrderDetail = {
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string;
  event: { name: string; startsAt: string };
  items: { name: string; quantity: number; unitPrice: string; subtotal: string }[];
  payment?: { status: string; method: string; reference?: string | null } | null;
};

export type InitialLookup = { orderNumber: string; token: string; detail: OrderDetail | null; error: string };

const STATUS_META: Record<
  OrderStatus,
  { label: string; tone: "crimson" | "champ" | "dark"; icon: typeof Clock; body: string }
> = {
  PENDING_CONFIRMATION: {
    label: "Menunggu konfirmasi",
    tone: "champ",
    icon: Clock,
    body: "Pesanan sudah diterima dan kuota ditahan. Admin sedang memverifikasi pembayaran Anda.",
  },
  CONFIRMED: {
    label: "Terkonfirmasi",
    tone: "crimson",
    icon: CheckCircle2,
    body: "Pembayaran terverifikasi. Tunjukkan nomor pesanan ini di pintu masuk arena.",
  },
  USED: {
    label: "Sudah masuk",
    tone: "dark",
    icon: Ticket,
    body: "Tiket ini sudah dipindai di pintu masuk. Unduh ulang tetap bisa, tapi tiket tidak dapat dipakai dua kali.",
  },
  REJECTED: {
    label: "Ditolak",
    tone: "dark",
    icon: XCircle,
    body: "Pesanan ditolak dan kuota tiket dikembalikan. Hubungi admin bila Anda merasa ini keliru.",
  },
  CANCELLED: {
    label: "Dibatalkan",
    tone: "dark",
    icon: XCircle,
    body: "Pesanan dibatalkan dan kuota tiket dikembalikan.",
  },
};

const rupiah = (value: string | number) => `Rp ${Number(value).toLocaleString("id-ID")}`;

/**
 * Deep links arrive pre-resolved from the server page (`initial`), so this component
 * never has to fetch inside an effect — the first paint already shows the receipt.
 */
export default function OrderStatusLookup({ initial }: { initial?: InitialLookup }) {
  const [orderNumber, setOrderNumber] = useState(initial?.orderNumber ?? "");
  const [token, setToken] = useState(initial?.token ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial?.error ?? "");
  const [detail, setDetail] = useState<OrderDetail | null>(initial?.detail ?? null);

  async function lookup(number: string, accessToken: string) {
    setBusy(true);
    setError("");
    setDetail(null);
    try {
      const response = await fetch(
        `/api/ticketing/orders/${encodeURIComponent(number.trim())}?token=${encodeURIComponent(accessToken.trim())}`
      );
      const data = (await response.json().catch(() => ({}))) as OrderDetail & { error?: string };
      if (!response.ok) {
        setError(
          response.status === 404
            ? "Pesanan tidak ditemukan. Periksa nomor pesanan dan token Anda."
            : response.status === 401
              ? "Token akses wajib diisi."
              : data.error ?? "Tidak dapat memeriksa pesanan."
        );
        return;
      }
      setDetail(data);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const meta = detail ? STATUS_META[detail.status] ?? STATUS_META.CANCELLED : null;
  const StatusIcon = meta?.icon;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(orderNumber, token);
        }}
        className="border border-border-subtle bg-charcoal p-5 sm:p-6"
      >
        <h2 className="font-display text-xl font-black uppercase tracking-tight text-ink">Cek pesanan</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Masukkan nomor pesanan dan token akses yang Anda terima setelah memesan.
        </p>

        <label className="mt-5 grid gap-1">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">Nomor pesanan</span>
          <input
            name="orderNumber"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder="TFN-XXXXXXXX-XXXXXXX"
            required
            className="h-11 border border-border-subtle bg-canvas px-3 font-mono-data text-sm uppercase text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
          />
        </label>

        <label className="mt-3 grid gap-1">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">Token akses</span>
          <input
            name="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Tempel token Anda"
            required
            className="h-11 border border-border-subtle bg-canvas px-3 font-mono-data text-xs text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
          />
        </label>

        {error && (
          <p role="status" className="mt-4 border-l-2 border-fight-red bg-fight-red/10 px-3 py-2 text-xs text-ink">
            {error}
          </p>
        )}

        <Button type="submit" variant="crimson" size="md" disabled={busy} className="mt-5 w-full">
          {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Memeriksa…" : "Periksa status"}
        </Button>

        <p className="mt-4 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-ink-subtle">
          Kehilangan token? Hubungi admin melalui kanal kontak resmi dengan menyebutkan email pemesan
          yang Anda gunakan saat membeli.
        </p>
      </form>

      <div aria-live="polite">
        {!detail && !busy && (
          <div className="flex h-full min-h-64 flex-col items-center justify-center border border-dashed border-border-subtle bg-canvas p-8 text-center">
            <p className="font-display text-lg font-bold uppercase tracking-tight text-ink-muted">
              Belum ada pesanan diperiksa
            </p>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-ink-subtle">
              Hasil pemeriksaan akan muncul di sini: status pembayaran, kategori tiket, dan total yang
              harus dibayar.
            </p>
          </div>
        )}

        {detail && meta && StatusIcon && (
          <article className="border border-border-subtle bg-charcoal p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant={meta.tone}>{meta.label}</Badge>
                <h2 className="mt-2 select-all break-all font-mono-data text-lg font-bold text-ink">
                  {detail.orderNumber}
                </h2>
                <p className="mt-1 font-mono-data text-xs uppercase tracking-wider text-ink-muted">{detail.event.name}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center border border-border-subtle text-fight-red">
                <StatusIcon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            <p className="mt-4 border-l-2 border-fight-red pl-3 text-sm leading-relaxed text-ink">{meta.body}</p>

            <table className="mt-5 w-full border-collapse text-left text-xs">
              <caption className="sr-only">Rincian tiket pesanan {detail.orderNumber}</caption>
              <thead>
                <tr className="border-b border-border-subtle font-mono-data uppercase tracking-[0.15em] text-ink-muted">
                  <th scope="col" className="py-2">Kategori</th>
                  <th scope="col" className="py-2 text-center">Jumlah</th>
                  <th scope="col" className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.name} className="border-b border-border-subtle/60 text-ink">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-center font-mono-data">{item.quantity}</td>
                    <td className="py-2 text-right font-mono-data">{rupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="pt-3 font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">
                    Total
                  </td>
                  <td className="pt-3 text-right font-display text-lg font-black text-ink">{rupiah(detail.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>

            {detail.payment && (
              <dl className="mt-5 grid gap-2 border-t border-border-subtle pt-4 font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-subtle sm:grid-cols-3">
                <div>
                  <dt>Metode</dt>
                  <dd className="mt-0.5 text-ink">{methodLabel(detail.payment.method)}</dd>
                </div>
                <div>
                  <dt>Status bayar</dt>
                  <dd className="mt-0.5 text-ink">{paymentStatusLabel(detail.payment.status)}</dd>
                </div>
                <div>
                  <dt>Referensi</dt>
                  <dd className="mt-0.5 break-all text-ink">{detail.payment.reference ?? "—"}</dd>
                </div>
              </dl>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {(detail.status === "CONFIRMED" || detail.status === "USED") && (
                <Button asChild variant="crimson" size="md">
                  <a
                    href={`/tickets/${encodeURIComponent(detail.orderNumber)}/ticket?token=${encodeURIComponent(token.trim())}`}
                    download
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    Unduh tiket (PDF)
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" size="md">
                <Link href="/tickets">Pesan tiket lagi</Link>
              </Button>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
