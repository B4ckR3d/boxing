"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { METHOD_LABEL } from "@/lib/ticketing/labels";

export type PublicTicketType = {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
  price: number;
  available: number;
};

type Props = {
  eventId: string;
  eventName: string;
  eventStartsAt?: string;
  eventVenue?: string | null;
  ticketTypes: PublicTicketType[];
};

const MAX_PER_ORDER = 10;

const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function TicketOrderForm({
  eventId,
  eventName,
  eventStartsAt,
  eventVenue,
  ticketTypes,
}: Props) {
  const initial = ticketTypes.find((t) => t.available > 0) ?? ticketTypes[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ orderNumber: string; token: string; amount: number; category: string; quantity: number; method: string } | null>(null);

  const selected = ticketTypes.find((t) => t.id === selectedId);
  const maxQty = Math.max(1, Math.min(MAX_PER_ORDER, selected?.available ?? 0));
  const total = useMemo(() => (selected ? selected.price * quantity : 0), [selected, quantity]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected) return;

    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    if (quantity < 1 || quantity > maxQty) {
      setError(`Jumlah tiket untuk kategori ini harus antara 1 dan ${maxQty}.`);
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/ticketing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          ticketTypeId: selected.id,
          quantity,
          customerName: form.get("customerName"),
          customerEmail: form.get("customerEmail"),
          customerPhone: form.get("customerPhone"),
          paymentMethod: form.get("paymentMethod"),
          reference: form.get("reference") || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        orderNumber?: string;
        capabilityToken?: string;
        error?: string;
      };

      if (response.ok && data.orderNumber && data.capabilityToken) {
        setReceipt({
          orderNumber: data.orderNumber,
          token: data.capabilityToken,
          amount: total,
          category: selected.name,
          quantity,
          method: String(form.get("paymentMethod") ?? "BANK_TRANSFER"),
        });
        formEl.reset();
        setQuantity(1);
      } else {
        setError(data.error ?? `Pesanan gagal dibuat (HTTP ${response.status}).`);
      }
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <section
        aria-labelledby="receipt-title"
        className="border border-fight-red/50 bg-fight-red/5 p-6 sm:p-8"
      >
        <Badge variant="crimson">Pesanan diterima</Badge>
        <h3 id="receipt-title" className="mt-3 font-display text-2xl font-black uppercase tracking-tight text-ink sm:text-3xl">
          Simpan kode ini
        </h3>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Pembayaran diverifikasi manual oleh admin. Gunakan nomor pesanan dan token di bawah untuk
          memeriksa status. Token hanya dikirim satu kali dan tidak dapat dipulihkan.
        </p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="border border-border-subtle bg-canvas p-4">
            <dt className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">Nomor pesanan</dt>
            <dd className="mt-1 select-all break-all font-mono-data text-sm font-bold text-ink">{receipt.orderNumber}</dd>
          </div>
          <div className="border border-border-subtle bg-canvas p-4">
            <dt className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">Token akses</dt>
            <dd className="mt-1 select-all break-all font-mono-data text-sm font-bold text-fight-red">{receipt.token}</dd>
          </div>
        </dl>
        <dl className="mt-3 grid gap-3 border border-border-subtle bg-canvas p-4 sm:grid-cols-3">
          <div>
            <dt className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">Kategori</dt>
            <dd className="mt-1 text-sm font-bold text-ink">
              {receipt.category} × {receipt.quantity}
            </dd>
          </div>
          <div>
            <dt className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">Metode pembayaran</dt>
            <dd className="mt-1 text-sm font-bold text-ink" id="receipt-method">
              {METHOD_LABEL[receipt.method] ?? receipt.method}
            </dd>
          </div>
          <div>
            <dt className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">Total yang harus dibayar</dt>
            <dd className="mt-1 font-mono-data text-sm font-bold text-fight-red" id="receipt-total">
              {rupiah(receipt.amount)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-muted">
          Bayar sesuai total di atas dan cantumkan nomor pesanan pada berita transfer/struk. Admin
          memverifikasi manual, lalu status berubah menjadi <strong>Dikonfirmasi</strong>.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild variant="crimson" size="md">
            <Link href={`/tickets/status?order=${receipt.orderNumber}&token=${receipt.token}`}>Cek status pesanan</Link>
          </Button>
          <Button variant="outline" size="md" onClick={() => setReceipt(null)}>
            Pesan tiket lain
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <fieldset className="border-0 p-0">
        <legend className="mb-3 font-mono-data text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          1 — Pilih kategori
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ticketTypes.map((type) => {
            const isActive = type.id === selectedId;
            const soldOut = type.available < 1;
            return (
              <button
                key={type.id}
                type="button"
                aria-pressed={isActive}
                disabled={soldOut}
                onClick={() => {
                  setSelectedId(type.id);
                  setQuantity(1);
                  setError("");
                }}
                className={[
                  "group relative flex flex-col items-start gap-1 border p-4 text-left transition-all",
                  soldOut
                    ? "cursor-not-allowed border-border-subtle bg-canvas/40 opacity-50"
                    : isActive
                      ? "border-fight-red bg-fight-red/10 shadow-[0_0_0_1px_var(--fight-red)]"
                      : "border-border-subtle bg-surface hover:border-ink-muted",
                ].join(" ")}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="font-display text-lg font-black uppercase leading-tight tracking-tight text-ink">
                    {type.name}
                  </span>
                  {soldOut ? (
                    <Badge variant="dark">Habis</Badge>
                  ) : isActive ? (
                    <Badge variant="crimson">Dipilih</Badge>
                  ) : null}
                </div>
                <span className="font-mono-data text-sm font-bold text-fight-red">{rupiah(type.price)}</span>
                {type.description && (
                  <span className="text-xs leading-relaxed text-ink-muted">{type.description}</span>
                )}
                <span className="mt-1 font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-subtle">
                  {soldOut ? "Kuota penuh" : `Sisa ${type.available} tiket`}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="border-0 p-0">
          <legend className="mb-3 font-mono-data text-[10px] uppercase tracking-[0.25em] text-ink-muted">
            2 — Jumlah
          </legend>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Kurangi jumlah"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="h-11 w-11 border border-border-subtle bg-surface font-display text-lg font-bold text-ink transition-colors hover:border-fight-red disabled:opacity-40"
            >
              −
            </button>
            <input
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQty}
              value={quantity}
              onChange={(e) => {
                const next = Number(e.target.value);
                setQuantity(Number.isFinite(next) ? Math.min(maxQty, Math.max(1, next)) : 1);
              }}
              className="h-11 w-20 border border-border-subtle bg-canvas text-center font-mono-data text-base font-bold text-ink focus:border-fight-red focus:outline-none"
              required
            />
            <button
              type="button"
              aria-label="Tambah jumlah"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              className="h-11 w-11 border border-border-subtle bg-surface font-display text-lg font-bold text-ink transition-colors hover:border-fight-red disabled:opacity-40"
            >
              +
            </button>
            <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-subtle">
              Maks {maxQty}
            </span>
          </div>
        </fieldset>

        <div className="border border-fight-red/40 bg-fight-red/5 p-4">
          <p className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">Total bayar</p>
          <p className="mt-1 font-display text-3xl font-black tracking-tight text-ink">{rupiah(total)}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {selected ? `${selected.name} × ${quantity}` : "Pilih kategori tiket"}
          </p>
        </div>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="mb-3 font-mono-data text-[10px] uppercase tracking-[0.25em] text-ink-muted">
          3 — Data pemesan
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">Nama</span>
            <input
              name="customerName"
              required
              maxLength={120}
              placeholder="Nama lengkap"
              className="h-11 border border-border-subtle bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">Email</span>
            <input
              name="customerEmail"
              type="email"
              required
              maxLength={180}
              placeholder="nama@email.com"
              className="h-11 border border-border-subtle bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">Telepon</span>
            <input
              name="customerPhone"
              required
              maxLength={32}
              placeholder="08xxxxxxxxxx"
              className="h-11 border border-border-subtle bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">
              Metode pembayaran
            </span>
            <select
              name="paymentMethod"
              defaultValue="BANK_TRANSFER"
              className="h-11 border border-border-subtle bg-canvas px-3 text-sm text-ink focus:border-fight-red focus:outline-none"
            >
              <option value="BANK_TRANSFER">Transfer bank (verifikasi manual)</option>
              <option value="QRIS">QRIS</option>
              <option value="CASH">Tunai di lokasi</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">
              Referensi pembayaran <span className="text-ink-subtle">(opsional)</span>
            </span>
            <input
              name="reference"
              maxLength={120}
              placeholder="Contoh: nomor transaksi / BCA-778899"
              className="h-11 border border-border-subtle bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
            />
          </label>
        </div>
      </fieldset>

      {error && (
        <p role="status" className="border-l-2 border-fight-red bg-fight-red/10 px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs leading-relaxed text-ink-muted">
          Dengan memesan Anda menyetujui tiket diverifikasi manual oleh admin. Kuota ditahan sejak
          pesanan dibuat dan dilepas kembali bila pesanan ditolak.
        </p>
        <Button type="submit" variant="crimson" size="lg" disabled={busy || !selected} className="sm:min-w-52">
          {busy ? "Memproses…" : `Pesan — ${rupiah(total)}`}
        </Button>
      </div>

      {eventStartsAt && (
        <p className="sr-only">
          {eventName} · {new Date(eventStartsAt).toLocaleString("id-ID")} · {eventVenue ?? ""}
        </p>
      )}
    </form>
  );
}
