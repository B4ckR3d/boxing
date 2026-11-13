import { describe, expect, it } from "vitest";
import { ticketOrderInputSchema, ticketTypeInputSchema } from "@/server/services/ticketing.service";

describe("ticketing validation", () => {
  it("accepts a bounded guest order", () => {
    expect(ticketOrderInputSchema.parse({
      eventId: "event_1", ticketTypeId: "type_1", quantity: 2,
      customerName: "Ada Lovelace", customerEmail: "ada@example.com", customerPhone: "+628123456789",
      paymentMethod: "BANK_TRANSFER", reference: "TRX-123",
    }).quantity).toBe(2);
  });

  it("rejects quantities above the per-order cap and malformed email", () => {
    expect(() => ticketOrderInputSchema.parse({
      eventId: "e", ticketTypeId: "t", quantity: 11,
      customerName: "A", customerEmail: "not-email", customerPhone: "1", paymentMethod: "BANK_TRANSFER",
    })).toThrow();
  });

  it("requires positive quota and non-negative price for ticket types", () => {
    expect(() => ticketTypeInputSchema.parse({ eventId: "e", name: "VIP", code: "vip", price: -1, quota: 0 })).toThrow();
  });
});
