/**
 * Pemformatan ringkasan job — dipisah dari job-nya supaya bisa diuji tanpa database.
 *
 * Aturan keluaran (sama dengan `scripts/cron/expire-holds.sh`): cetak ke stdout HANYA bila
 * ada yang terjadi atau ada yang gagal. Cron yang diam berarti "tidak ada laporan".
 */

export type HoldExpirySummary = {
  scanned: number;
  expired: number;
  skipped: number;
  releasedSeats: number;
  orderNumbers: string[];
};

export function formatHoldExpiry(summary: HoldExpirySummary, elapsedMs: number): string {
  return (
    `[expire-holds] scanned=${summary.scanned} expired=${summary.expired} ` +
    `skipped=${summary.skipped} seatsReleased=${summary.releasedSeats} (${elapsedMs}ms)`
  );
}

/** Baris per pesanan yang dibatalkan; kosong bila tidak ada. */
export function formatCancelledOrders(summary: HoldExpirySummary): string[] {
  return summary.expired > 0 ? summary.orderNumbers.map((n) => `  - cancelled ${n}`) : [];
}

/**
 * Exit code job. `0` = bersih, `1` = gagal, `3` = jalan tapi tidak ada ringkasan valid.
 * Nonzero membuat cron/aaPanel benar-benar memberi tahu seseorang.
 */
export function exitCodeFor(summary: HoldExpirySummary | null): 0 | 1 | 3 {
  if (!summary) return 3;
  return 0;
}

/** Benar bila job menghasilkan sesuatu yang layak dikirim ke luar (stdout / notifikasi). */
export function isNoteworthy(summary: HoldExpirySummary): boolean {
  return summary.expired > 0;
}
