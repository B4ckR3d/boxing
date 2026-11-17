import { expireStaleHolds } from "../lib/ticketing.js";
import { env } from "../lib/env.js";
import { formatCancelledOrders, formatHoldExpiry, type HoldExpirySummary } from "../lib/report";

/**
 * Job hold-expiry (ADR-014).
 *
 * **Tidak** menduplikasi logika: memanggil `expireStaleHolds` yang sama dengan yang dipakai
 * route Next.js dan `pnpm ticketing:expire-holds`. Kalau aturan expiry berubah, satu tempat.
 *
 * Impor `@/…` menunjuk ke `apps/web/src` (lihat `paths` di tsconfig worker). Karena service
 * web memakai penanda `server-only`, proses ini harus dijalankan dengan
 * `--conditions=react-server` — sudah dibungkus di script `expire-holds`.
 */
export async function runExpireHolds(): Promise<{
  summary: HoldExpirySummary;
  elapsedMs: number;
  lines: string[];
  noteworthy: boolean;
}> {
  const hours = env().TICKET_HOLD_EXPIRY_HOURS;
  const startedAt = Date.now();
  const summary = (await expireStaleHolds({ olderThanHours: hours })) as HoldExpirySummary;
  const elapsedMs = Date.now() - startedAt;

  const lines = [formatHoldExpiry(summary, elapsedMs), ...formatCancelledOrders(summary)];
  return { summary, elapsedMs, lines, noteworthy: summary.expired > 0 };
}
