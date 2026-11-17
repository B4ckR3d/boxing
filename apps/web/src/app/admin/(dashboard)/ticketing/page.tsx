import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, ScanLine, Ticket, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import TicketOrderActions from "@/components/admin/TicketOrderActions";
import { saveTicketTypeAction } from "./actions";
import { methodLabel, paymentStatusLabel } from "@/lib/ticketing/labels";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Menunggu" },
  { key: "confirmed", label: "Terkonfirmasi" },
  { key: "used", label: "Sudah masuk" },
  { key: "rejected", label: "Ditolak" },
] as const;

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PENDING_CONFIRMATION: { label: "Menunggu", className: "border-amber-500/60 text-amber-500" },
  CONFIRMED: { label: "Terkonfirmasi", className: "border-emerald-500/60 text-emerald-500" },
  USED: { label: "Sudah masuk", className: "border-sky-500/60 text-sky-400" },
  REJECTED: { label: "Ditolak", className: "border-fight-red/60 text-fight-red" },
  CANCELLED: { label: "Dibatalkan", className: "border-border-subtle text-ink-muted" },
};

const rupiah = (value: number | string) => `Rp ${Number(value).toLocaleString("id-ID")}`;

export default async function TicketingAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const isSuperAdmin = session.roles.includes("super_admin");
  const canRead = isSuperAdmin || hasPermission(session, "ticketing.read");
  const canManage = isSuperAdmin || hasPermission(session, "ticketing.manage");
  const canConfirm = isSuperAdmin || hasPermission(session, "ticketing.confirm");

  if (!canRead) {
    return (
      <main className="p-8">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-ink">Akses ditolak</h1>
        <p className="mt-2 text-sm text-ink-muted">Peran Anda tidak memiliki izin membaca data ticketing.</p>
      </main>
    );
  }

  const { status: statusParam } = await searchParams;
  const filter = FILTERS.some((f) => f.key === statusParam) ? (statusParam as string) : "all";
  const statusWhere =
    filter === "pending"
      ? { status: "PENDING_CONFIRMATION" as const }
      : filter === "confirmed"
        ? { status: "CONFIRMED" as const }
        : filter === "used"
          ? { status: "USED" as const }
          : filter === "rejected"
            ? { status: "REJECTED" as const }
            : {};

  const [types, orders, counts, confirmedSum] = await Promise.all([
    prisma.ticketType.findMany({ include: { event: true }, orderBy: { createdAt: "asc" } }),
    prisma.ticketOrder.findMany({
      where: statusWhere,
      include: { event: true, items: { include: { ticketType: true } }, payment: true, checkedInBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.ticketOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    // USED is money already banked: a ticket that walked in counts as confirmed revenue, otherwise
    // the headline number drops the moment the doors open.
    prisma.ticketOrder.aggregate({
      where: { status: { in: ["CONFIRMED", "USED"] } },
      _sum: { totalAmount: true },
    }),
  ]);

  const countOf = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
  const stats = [
    { label: "Menunggu konfirmasi", value: countOf("PENDING_CONFIRMATION"), icon: Clock, tone: "text-amber-500" },
    { label: "Terkonfirmasi", value: countOf("CONFIRMED"), icon: CheckCircle2, tone: "text-emerald-500" },
    { label: "Sudah check-in", value: countOf("USED"), icon: Ticket, tone: "text-sky-400" },
    {
      label: "Pendapatan terkonfirmasi",
      value: rupiah(Number(confirmedSum._sum.totalAmount ?? 0)),
      icon: TrendingUp,
      tone: "text-ink",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <p className="font-mono-data text-[10px] uppercase tracking-[0.25em] text-fight-red">CMS · Ticketing</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight text-ink sm:text-4xl">
            Pesanan &amp; kuota tiket
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Konfirmasi manual pembayaran. Kuota ditahan saat pesanan dibuat dan otomatis dilepas bila
            pesanan ditolak.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {canConfirm && (
            <Link
              href="/admin/ticketing/scan"
              className="inline-flex items-center gap-2 border border-fight-red bg-fight-red px-3 py-1.5 font-mono-data text-[10px] font-bold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-fight-red-hover"
            >
              <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
              Scan check-in
            </Link>
          )}
          <Link
            href="/tickets"
            className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-ink-muted underline decoration-fight-red underline-offset-4 hover:text-ink"
          >
            Lihat halaman tiket publik
          </Link>
        </div>
      </header>

      <section aria-label="Ringkasan ticketing" className="grid gap-px border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-charcoal p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">{stat.label}</p>
                <Icon className={`h-4 w-4 ${stat.tone}`} aria-hidden="true" />
              </div>
              <p className={`mt-2 font-display text-2xl font-black tracking-tight ${stat.tone}`}>{stat.value}</p>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="quota-heading" className="border border-border-subtle bg-charcoal">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
          <h2 id="quota-heading" className="font-display text-xl font-bold uppercase tracking-tight text-ink">
            Kuota kategori
          </h2>
          <Badge variant="dark">{types.length} kategori</Badge>
        </div>
        <div className="divide-y divide-border-subtle">
          {types.length === 0 && (
            <p className="p-4 text-sm text-ink-muted">Belum ada kategori tiket.</p>
          )}
          {types.map((type) => {
            const soldPct = type.quota > 0 ? Math.min(100, Math.round((type.sold / type.quota) * 100)) : 0;
            return (
              <div key={type.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold uppercase tracking-tight text-ink">
                      {type.name}
                    </span>
                    <span className="font-mono-data text-[10px] uppercase tracking-wider text-ink-subtle">
                      {type.event.name}
                    </span>
                    {!type.isActive && <Badge variant="dark">Nonaktif</Badge>}
                  </div>
                  <div className="mt-2 h-1.5 w-full max-w-md bg-border-subtle">
                    <div
                      className="h-1.5 bg-fight-red transition-all"
                      style={{ width: `${soldPct}%` }}
                      role="progressbar"
                      aria-valuenow={type.sold}
                      aria-valuemin={0}
                      aria-valuemax={type.quota}
                      aria-label={`${type.name}: ${type.sold} dari ${type.quota} terjual`}
                    />
                  </div>
                  <p className="mt-1 font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">
                    {type.sold}/{type.quota} terjual · sisa {type.quota - type.sold}
                  </p>
                </div>
                <p className="font-mono-data text-sm font-bold text-ink sm:text-right">{rupiah(Number(type.price))}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="orders-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="orders-heading" className="font-display text-xl font-bold uppercase tracking-tight text-ink">
            Pesanan
          </h2>
          <nav aria-label="Filter status pesanan" className="flex flex-wrap gap-1">
            {FILTERS.map((item) => {
              const active = item.key === filter;
              return (
                <Link
                  key={item.key}
                  href={item.key === "all" ? "/admin/ticketing" : `/admin/ticketing?status=${item.key}`}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "border px-3 py-1.5 font-mono-data text-[10px] font-bold uppercase tracking-[0.15em] transition-colors",
                    active
                      ? "border-fight-red bg-fight-red text-ink"
                      : "border-border-subtle text-ink-muted hover:border-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  {item.label}
                  {item.key !== "all" && (
                    <span className="ml-1.5 opacity-70">
                      {countOf(
                        item.key === "pending"
                          ? "PENDING_CONFIRMATION"
                          : item.key === "confirmed"
                            ? "CONFIRMED"
                            : item.key === "used"
                              ? "USED"
                              : "REJECTED"
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {orders.length === 0 ? (
          <div className="border border-dashed border-border-subtle bg-canvas p-10 text-center">
            <Ticket className="mx-auto h-6 w-6 text-ink-subtle" aria-hidden="true" />
            <p className="mt-3 font-display text-lg font-bold uppercase tracking-tight text-ink-muted">
              Tidak ada pesanan pada filter ini
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const style = STATUS_STYLES[order.status] ?? STATUS_STYLES.CANCELLED!;
              return (
                <article
                  key={order.id}
                  className="border border-border-subtle bg-charcoal p-4 transition-colors hover:border-ink-muted/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="select-all font-mono-data text-sm font-bold text-ink">{order.orderNumber}</span>
                        <span
                          className={`border px-2 py-0.5 font-mono-data text-[10px] font-bold uppercase tracking-[0.15em] ${style.className}`}
                        >
                          {style.label}
                        </span>
                        {order.payment && (
                          <span className="font-mono-data text-[10px] uppercase tracking-wider text-ink-subtle">
                            {paymentStatusLabel(order.payment.status)} · {methodLabel(order.payment.method)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">
                        {order.event.name} ·{" "}
                        {order.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    <p className="font-display text-xl font-black tracking-tight text-ink">
                      {rupiah(Number(order.totalAmount))}
                    </p>
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 border-t border-border-subtle pt-3 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-subtle">Pemesan</dt>
                      <dd className="text-ink">{order.customerName}</dd>
                    </div>
                    <div>
                      <dt className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-subtle">Kontak</dt>
                      <dd className="break-all text-ink-muted">
                        {order.customerEmail} · {order.customerPhone}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-subtle">Tiket</dt>
                      <dd className="text-ink">
                        {order.items.map((item) => `${item.ticketType.name} × ${item.quantity}`).join(", ")}
                      </dd>
                    </div>
                  </dl>

                  {order.customerNote && (
                    <p className="mt-3 border-l-2 border-border-subtle pl-3 text-xs italic text-ink-muted">
                      “{order.customerNote}”
                    </p>
                  )}

                  {order.status === "USED" && order.checkedInAt && (
                    <p className="mt-3 border-l-2 border-sky-500/60 pl-3 font-mono-data text-[10px] uppercase tracking-[0.12em] text-sky-400">
                      Check-in{" "}
                      {order.checkedInAt.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      {" · "}
                      {order.checkedInBy?.name ?? "operator"}
                    </p>
                  )}

                  {order.status === "PENDING_CONFIRMATION" && canConfirm && (
                    <div className="mt-4 border-t border-border-subtle pt-3">
                      <TicketOrderActions orderId={order.id} orderNumber={order.orderNumber} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {canManage && (
        <section aria-labelledby="create-type-heading" className="border border-border-subtle bg-charcoal">
          <div className="border-b border-border-subtle p-4">
            <h2 id="create-type-heading" className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight text-ink">
              <CalendarDays className="h-4 w-4 text-fight-red" aria-hidden="true" />
              Tambah kategori tiket
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Kategori baru langsung tersedia di halaman tiket publik untuk event yang dipilih.
            </p>
          </div>
          <form
            action={async (formData) => {
              "use server";
              await saveTicketTypeAction({
                eventId: formData.get("eventId"),
                name: formData.get("name"),
                code: formData.get("code"),
                price: formData.get("price"),
                quota: formData.get("quota"),
                isActive: true,
              });
            }}
            className="grid gap-3 p-4 sm:grid-cols-2"
          >
            <label className="grid gap-1 sm:col-span-2">
              <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">Event</span>
              <select name="eventId" required className="h-10 border border-border-subtle bg-canvas px-2.5 text-sm text-ink">
                {types.length === 0 && <option value="">Belum ada event</option>}
                {[...new Map(types.map((t) => [t.event.id, t.event])).values()].map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            {[
              { name: "name", label: "Nama kategori", type: "text", placeholder: "VIP Ringside" },
              { name: "code", label: "Kode", type: "text", placeholder: "vip-ringsides" },
              { name: "price", label: "Harga (Rp)", type: "number", placeholder: "750000" },
              { name: "quota", label: "Kuota", type: "number", placeholder: "60" },
            ].map((field) => (
              <label key={field.name} className="grid gap-1">
                <span className="font-mono-data text-[10px] uppercase tracking-[0.15em] text-ink-muted">{field.label}</span>
                <input
                  name={field.name}
                  type={field.type}
                  min={field.type === "number" ? 0 : undefined}
                  placeholder={field.placeholder}
                  required
                  className="h-10 border border-border-subtle bg-canvas px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-fight-red focus:outline-none"
                />
              </label>
            ))}
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center border border-fight-red bg-fight-red px-4 font-display text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-fight-red-hover"
              >
                Simpan kategori
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
