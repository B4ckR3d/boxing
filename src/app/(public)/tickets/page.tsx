import Link from "next/link";
import { Calendar, MapPin, ChevronRight, ShieldCheck, Ticket, Wallet } from "lucide-react";
import { listPublishedTicketEvents } from "@/server/services/ticketing.service";
import TicketOrderForm from "@/components/ticketing/TicketOrderForm";
import { OfficialSupport } from "@/components/landing/OfficialSupport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: Ticket,
    title: "Pilih kategori",
    body: "Tentukan kategori dan jumlah tiket. Kuota langsung ditahan untuk Anda.",
  },
  {
    icon: Wallet,
    title: "Bayar & kirim referensi",
    body: "Transfer bank, QRIS, atau tunai. Simpan nomor transaksi sebagai referensi.",
  },
  {
    icon: ShieldCheck,
    title: "Verifikasi admin",
    body: "Admin mengonfirmasi pembayaran. Simpan nomor pesanan dan token untuk cek status.",
  },
];

export default async function TicketsPage() {
  const events = await listPublishedTicketEvents();

  return (
    <div>
      {/* Hero */}
      <section
        className="relative border-b border-subtle bg-cover bg-center py-20"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 text-center">
          <Badge variant="crimson">Tiket resmi</Badge>
          <h1 className="mt-4 font-display text-4xl font-black uppercase tracking-tight text-ink sm:text-6xl">
            Amankan kursi Anda
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
            Tiket dijual langsung oleh penyelenggara Temanggung Fight Night. Pembayaran diverifikasi
            manual oleh admin — tidak ada biaya perantara.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 font-mono-data text-xs uppercase tracking-widest text-ink-muted">
            <Link href="/" className="transition-colors hover:text-ink">
              Beranda
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
            <span className="font-bold text-fight-red">Tiket</span>
          </div>
        </div>
      </section>

      {/* Official event + government backing, above the purchase panel */}
      <OfficialSupport />

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        {/* How it works */}
        <section aria-label="Cara membeli tiket" className="grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="bg-charcoal p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-fight-red text-fight-red">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-subtle">
                      Langkah {index + 1}
                    </p>
                    <h2 className="font-display text-lg font-bold uppercase tracking-tight text-ink">
                      {step.title}
                    </h2>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            );
          })}
        </section>

        {events.length === 0 ? (
          <section className="border border-border-subtle bg-charcoal p-10 text-center">
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-ink">
              Belum ada tiket tersedia
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Jadwal penjualan tiket akan diumumkan di halaman jadwal. Pantau terus agar tidak
              ketinggalan.
            </p>
            <div className="mt-5 flex justify-center">
              <Button asChild variant="outline" size="md">
                <Link href="/events">Lihat jadwal event</Link>
              </Button>
            </div>
          </section>
        ) : (
          events.map((event) => {
            const date = new Date(event.startsAt);
            const day = date.toLocaleDateString("id-ID", { day: "2-digit" });
            const month = date.toLocaleDateString("id-ID", { month: "short" }).toUpperCase();
            const totalLeft = event.ticketTypes.reduce((sum, t) => sum + (t.quota - t.sold), 0);

            return (
              <section key={event.id} aria-labelledby={`event-${event.id}`} className="border border-border-subtle bg-charcoal">
                {/* Event header */}
                <header className="flex flex-col gap-5 border-b border-border-subtle p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-fight-red px-3 py-2 text-center leading-none text-ink">
                      <Calendar className="mx-auto mb-1 h-3.5 w-3.5 opacity-90" aria-hidden="true" />
                      <span className="block font-display text-base font-black">{day}</span>
                      <span className="block font-mono-data text-[10px] font-bold uppercase tracking-wider">
                        {month}
                      </span>
                    </div>
                    <div>
                      <h2
                        id={`event-${event.id}`}
                        className="font-display text-2xl font-black uppercase leading-tight tracking-tight text-ink sm:text-3xl"
                      >
                        {event.name}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-data text-xs uppercase tracking-wider text-ink-muted">
                        <span>
                          {date.toLocaleString("id-ID", {
                            dateStyle: "full",
                            timeStyle: "short",
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-fight-red" aria-hidden="true" />
                          {event.venue ?? "Lokasi menyusul"}
                          {event.city ? `, ${event.city}` : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="dark">{totalLeft} tiket tersisa</Badge>
                    <Badge variant="champ">Verifikasi manual</Badge>
                  </div>
                </header>

                {/* Purchase panel */}
                <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    <TicketOrderForm
                      eventId={event.id}
                      eventName={event.name}
                      eventStartsAt={event.startsAt.toISOString()}
                      eventVenue={event.venue}
                      ticketTypes={event.ticketTypes.map((type) => ({
                        id: type.id,
                        name: type.name,
                        code: type.code,
                        description: type.description,
                        price: Number(type.price),
                        available: type.quota - type.sold,
                      }))}
                    />
                  </div>

                  <aside className="border border-border-subtle bg-canvas p-5">
                    <h3 className="font-display text-lg font-bold uppercase tracking-tight text-ink">
                      Sudah memesan?
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                      Cek status pembayaran dengan nomor pesanan dan token yang Anda terima saat
                      memesan.
                    </p>
                    <Button asChild variant="dark" size="md" className="mt-4 w-full">
                      <Link href="/tickets/status">Cek status pesanan</Link>
                    </Button>
                    <dl className="mt-5 space-y-2 border-t border-border-subtle pt-4 font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-subtle">
                      <div className="flex justify-between gap-2">
                        <dt>Kategori aktif</dt>
                        <dd className="text-ink">{event.ticketTypes.length}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Maks per pesanan</dt>
                        <dd className="text-ink">10 tiket</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Konfirmasi</dt>
                        <dd className="text-ink">Manual admin</dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
