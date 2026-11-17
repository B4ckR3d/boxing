import { describe, expect, it } from "vitest";
import { exitCodeFor, formatCancelledOrders, formatHoldExpiry, isNoteworthy, type HoldExpirySummary } from "../src/lib/report";

const base: HoldExpirySummary = { scanned: 7, expired: 2, skipped: 5, releasedSeats: 4, orderNumbers: ["TFN-A", "TFN-B"] };

describe("format keluaran job expire-holds (ADR-014)", () => {
  it("meringkas angka sweep dalam satu baris", () => {
    expect(formatHoldExpiry(base, 120)).toBe(
      "[expire-holds] scanned=7 expired=2 skipped=5 seatsReleased=4 (120ms)",
    );
  });

  it("mencetak satu baris per pesanan yang dibatalkan", () => {
    expect(formatCancelledOrders(base)).toEqual(["  - cancelled TFN-A", "  - cancelled TFN-B"]);
  });

  it("tidak mencetak apa pun bila tidak ada yang kedaluwarsa", () => {
    const quiet: HoldExpirySummary = { ...base, expired: 0, orderNumbers: [] };
    expect(formatCancelledOrders(quiet)).toEqual([]);
    expect(isNoteworthy(quiet)).toBe(false);
  });

  it("menandai job layak dilaporkan hanya bila ada pesanan dibatalkan", () => {
    expect(isNoteworthy(base)).toBe(true);
  });

  it("memakai exit code 3 saat ringkasan tidak terbentuk, 0 saat bersih", () => {
    expect(exitCodeFor(null)).toBe(3);
    expect(exitCodeFor(base)).toBe(0);
  });
});
