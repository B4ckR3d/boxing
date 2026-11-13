import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import OrderStatusLookup, { type InitialLookup, type OrderDetail, type OrderStatus } from "@/components/ticketing/OrderStatusLookup";
import { getGuestOrder } from "@/server/services/ticketing.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cek Status Pesanan Tiket — TFN",
  description: "Periksa status pembayaran dan konfirmasi pesanan tiket Temanggung Fight Night.",
};

async function resolveDeepLink(
  order?: string,
  token?: string
): Promise<InitialLookup | undefined> {
  if (!order || !token) return undefined;
  try {
    const result = await getGuestOrder(order, token);
    const detail: OrderDetail = {
      orderNumber: result.orderNumber,
      status: result.status as OrderStatus,
      totalAmount: String(result.totalAmount),
      event: { name: result.event.name, startsAt: result.event.startsAt.toISOString() },
      items: result.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        subtotal: String(item.subtotal),
      })),
      payment: result.payment
        ? { status: String(result.payment.status), method: String(result.payment.method), reference: result.payment.reference }
        : null,
    };
    return { orderNumber: order, token, detail, error: "" };
  } catch {
    return {
      orderNumber: order,
      token,
      detail: null,
      error: "Pesanan tidak ditemukan. Periksa nomor pesanan dan token Anda.",
    };
  }
}

export default async function TicketStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { order, token } = await searchParams;
  const initial = await resolveDeepLink(order, token);

  return (
    <div>
      <section
        className="relative border-b border-subtle bg-cover bg-center py-16"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--overlay-scrim), color-mix(in srgb, var(--overlay-scrim) 95%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <Badge variant="crimson">Layanan pemesan</Badge>
          <h1 className="mt-4 font-display text-4xl font-black uppercase tracking-tight text-ink sm:text-5xl">
            Cek status pesanan
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Status pembayaran tiket diverifikasi manual oleh admin. Gunakan nomor pesanan dan token
            akses Anda di bawah ini.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 font-mono-data text-xs uppercase tracking-widest text-ink-muted">
            <Link href="/" className="transition-colors hover:text-ink">Beranda</Link>
            <ChevronRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
            <Link href="/tickets" className="transition-colors hover:text-ink">Tiket</Link>
            <ChevronRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
            <span className="font-bold text-fight-red">Status pesanan</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <OrderStatusLookup initial={initial} />
      </div>
    </div>
  );
}
