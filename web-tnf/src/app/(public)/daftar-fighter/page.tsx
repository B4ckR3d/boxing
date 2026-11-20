import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Ticket, Trophy } from "lucide-react";
import { RegistrationForm } from "@/components/registrations/RegistrationForm";
import { env } from "@/lib/env";
import { formatIdr } from "@/lib/validation/registration";

export const metadata: Metadata = {
  title: "Pendaftaran Fighter | Temanggung Fight Night",
  description:
    "Formulir pendaftaran fighter Temanggung Fight Night. Isi data diri, pilih divisi dan kategori rules, lalu unggah bukti transfer pendaftaran.",
  alternates: { canonical: "/daftar-fighter" },
};

export const dynamic = "force-dynamic";

export default function RegisterFighterPage() {
  const feeIdr = env().REGISTRATION_FEE_IDR;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Hero */}
      <div
        className="relative border-b border-subtle bg-cover bg-center py-14 sm:py-20 text-center"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 92%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="mx-auto max-w-4xl px-4">
          <p className="font-mono-data text-[11px] uppercase tracking-[0.3em] text-fight-red">Temanggung Fight Night</p>
          <h1 className="mt-3 font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-ink">
            Pendaftaran Fighter
          </h1>
          <div className="mt-3 flex items-center justify-center gap-2 font-mono-data text-[11px] uppercase tracking-widest text-ink-muted">
            <Link href="/" className="transition-colors hover:text-ink">
              Beranda
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-ink-subtle" />
            <span className="font-bold text-fight-red">Daftar Fighter</span>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Lengkapi 5 bagian di bawah. Setelah terkirim Anda akan menerima kode pendaftaran — simpan kode tersebut
            untuk verifikasi bersama panitia.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="order-2 lg:order-1">
            <RegistrationForm feeIdr={feeIdr} />
          </div>

          <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-24">
            <div className="border border-border-subtle bg-surface p-5 space-y-3">
              <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Biaya Pendaftaran</p>
              <p className="font-display text-3xl font-black text-fight-red">{formatIdr(feeIdr)}</p>
              <p className="text-xs leading-relaxed text-ink-muted">
                Transfer ke <span className="text-ink">Seabank 901864586820</span> a.n. Maulana Irham Rianto, lalu
                unggah bukti transfer di bagian 4.
              </p>
            </div>

            <div className="border border-border-subtle bg-surface p-5 space-y-4">
              <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Syarat Penting</p>
              {[
                { icon: Ticket, text: "Usia minimal 15 tahun saat hari pertandingan." },
                { icon: ShieldCheck, text: "Wajib punya BPJS Ketenagakerjaan aktif. Jika belum, unggah KTP/KK." },
                { icon: Trophy, text: "Pilih divisi berat yang sesuai — penimbangan ulang dilakukan panitia." },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fight-red" />
                  <p className="text-xs leading-relaxed text-ink-muted">{text}</p>
                </div>
              ))}
            </div>

            <div className="border border-border-subtle bg-surface p-5 space-y-2">
              <p className="font-mono-data text-[10px] uppercase tracking-widest text-ink-muted">Alur Verifikasi</p>
              <ol className="space-y-2 text-xs leading-relaxed text-ink-muted">
                <li>
                  <span className="font-mono-data text-amber-500">1.</span> Data masuk — status{" "}
                  <span className="text-amber-500">Menunggu Konfirmasi</span>
                </li>
                <li>
                  <span className="font-mono-data text-emerald-500">2.</span> Dana diverifikasi admin — status{" "}
                  <span className="text-emerald-500">Terkonfirmasi</span>
                </li>
                <li>
                  <span className="font-mono-data text-ink-subtle">3.</span> Nama masuk daftar peserta pertandingan
                </li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
