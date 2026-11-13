import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Ticket } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import TicketScanner from "@/components/admin/TicketScanner";

export const dynamic = "force-dynamic";

export default async function TicketScanPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const isSuperAdmin = session.roles.includes("super_admin");
  const canScan = isSuperAdmin || hasPermission(session, "ticketing.confirm");

  if (!canScan) {
    return (
      <main className="p-8">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-ink">Akses ditolak</h1>
        <p className="mt-2 text-sm text-ink-muted">Peran Anda tidak memiliki izin check-in tiket di pintu masuk.</p>
      </main>
    );
  }

  const [events, usedCount, usedSeats, recent] = await Promise.all([
    prisma.event.findMany({
      where: { status: "SCHEDULED" },
      select: { id: true, name: true, startsAt: true },
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
    prisma.ticketOrder.count({ where: { status: "USED" } }),
    prisma.ticketOrderItem.aggregate({ where: { order: { status: "USED" } }, _sum: { quantity: true } }),
    prisma.ticketOrder.findMany({
      where: { status: "USED" },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        checkedInAt: true,
        checkedInBy: { select: { name: true, email: true } },
        event: { select: { name: true } },
        items: { select: { quantity: true } },
      },
      orderBy: { checkedInAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <p className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-fight-red">CMS · Ticketing · Pintu masuk</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight text-ink sm:text-4xl">Check-in tiket</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Pindai QR tiket atau ketik nomor pesanan. Setiap tiket hanya bisa dipakai sekali dan operator
            yang memindai tercatat di audit log.
          </p>
        </div>
        <Link
          href="/admin/ticketing"
          className="inline-flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted underline decoration-fight-red underline-offset-4 hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          Kembali ke pesanan
        </Link>
      </header>

      <section aria-label="Ringkasan check-in" className="grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2">
        <div className="bg-charcoal p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">Tiket sudah masuk</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-black tracking-tight text-emerald-500">{usedCount}</p>
          <p className="mt-1 text-xs text-ink-muted">pesanan · {usedSeats._sum.quantity ?? 0} kursi</p>
        </div>
        <div className="bg-charcoal p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">Check-in terakhir</p>
            <Ticket className="h-4 w-4 text-ink-muted" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono-data text-sm text-ink">{recent[0]?.orderNumber ?? "Belum ada"}</p>
          <p className="mt-1 truncate text-xs text-ink-muted">
            {recent[0]
              ? `${recent[0].customerName} · ${recent[0].items.reduce((sum, item) => sum + item.quantity, 0)} tiket`
              : "Tiket pertama akan muncul di sini"}
          </p>
        </div>
      </section>

      <TicketScanner
        events={events.map((event) => ({ id: event.id, name: event.name, startsAt: event.startsAt.toISOString() }))}
      />

      {recent.length > 0 && (
        <section aria-label="Check-in terbaru" className="border border-border-subtle">
          <header className="border-b border-border-subtle bg-charcoal px-4 py-2">
            <p className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted">Check-in terbaru</p>
          </header>
          <ul className="divide-y divide-border-subtle">
            {recent.map((order) => (
              <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono-data text-xs text-ink">{order.orderNumber}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {order.customerName} · {order.event.name} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} tiket
                  </p>
                </div>
                <p className="font-mono-data text-[10px] uppercase tracking-[0.12em] text-ink-subtle">
                  {order.checkedInAt
                    ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }).format(order.checkedInAt)
                    : "—"}{" "}
                  · {order.checkedInBy?.name ?? order.checkedInBy?.email ?? "operator"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-ink-muted">
        Tiket yang sudah check-in tetap dihitung dalam pendapatan terkonfirmasi dan tetap bisa diunduh
        ulang oleh pembeli.
      </p>
    </div>
  );
}
