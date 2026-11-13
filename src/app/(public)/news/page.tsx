import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata = {
  title: "Berita & Cerita | TFN — Temanggung Fight Night",
  description: "Informasi dan cerita seputar Temanggung Fight Night. Materi pratinjau ditandai sebagai demo.",
};

export default function NewsPage() {
  return (
    <div className="bg-canvas text-ink">
      <header className="relative isolate overflow-hidden border-b border-subtle bg-charcoal py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><p className="font-mono-data text-xs uppercase tracking-widest text-fight-red">TFN / RINGSIDE STORIES</p><h1 className="mt-4 font-display text-5xl font-bold sm:text-7xl">BERITA & CERITA</h1><p className="mt-5 max-w-xl text-sm leading-7 text-ink-muted">Cerita dari sasana, petarung, dan arena Temanggung Fight Night. Pengumuman acara dapat ditemukan melalui halaman agenda.</p></div>
      </header>
      <section aria-labelledby="news-status" className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
        <figure className="border border-subtle bg-charcoal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero/boxing-ring-arena.jpg" width={960} height={640} alt="Ilustrasi ring tinju dan pencahayaan arena" className="aspect-[4/3] w-full object-cover" /><figcaption className="px-5 py-4 font-mono-data text-xs text-ink-muted">VISUAL DEMO — bukan dokumentasi acara resmi.</figcaption>
        </figure>
        <div><p className="font-mono-data text-xs uppercase tracking-widest text-fight-red">RUANG REDAKSI TFN</p><h2 id="news-status" className="mt-4 font-display text-3xl font-bold sm:text-4xl">BELUM ADA ARTIKEL TERBIT.</h2><p className="mt-5 text-sm leading-7 text-ink-muted">Halaman ini tidak menampilkan hasil pertandingan, kutipan petarung, atau pengumuman yang belum diverifikasi. Kembali lagi untuk membaca pembaruan berikutnya.</p><Link href="/events" className="mt-7 inline-flex min-h-12 items-center gap-4 border border-subtle px-5 text-sm font-bold hover:border-fight-red">Lihat agenda acara<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div>
      </section>
    </div>
  );
}
