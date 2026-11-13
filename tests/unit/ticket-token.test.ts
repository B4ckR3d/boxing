import { describe, expect, it } from "vitest";
import { buildTicketPayload, verifyTicketPayload, TICKET_PAYLOAD_PREFIX } from "@/lib/ticketing/ticket-token";

const SECRET = "unit-test-secret-at-least-16-chars-long";
const ORDER = "TFN-ABCD1234-EFGH567";

describe("ticket QR payload", () => {
  it("builds a versioned 3-part payload that verifies back to the order number", () => {
    const payload = buildTicketPayload(ORDER, SECRET);
    const parts = payload.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(TICKET_PAYLOAD_PREFIX);
    expect(parts[1]).toBe(ORDER);
    expect(parts[2]).toHaveLength(12);
    expect(verifyTicketPayload(payload, SECRET)).toEqual({ orderNumber: ORDER });
  });

  it("normalises case and whitespace so a hand-typed/scanned code still verifies", () => {
    const payload = buildTicketPayload(`  ${ORDER.toLowerCase()}  `, SECRET);
    expect(verifyTicketPayload(payload.toLowerCase(), SECRET)).toEqual({ orderNumber: ORDER });
  });

  it("rejects a payload whose order number was swapped (ticket re-targeting)", () => {
    const payload = buildTicketPayload(ORDER, SECRET);
    const forged = payload.replace(ORDER, "TFN-ZZZZ9999-YYYY888");
    expect(verifyTicketPayload(forged, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const payload = buildTicketPayload(ORDER, SECRET);
    const signature = payload.split(".")[2] ?? "";
    const flipped = signature[0] === "A" ? "B" : "A";
    expect(verifyTicketPayload(`${payload.slice(0, -12)}${flipped}${signature.slice(1)}`, SECRET)).toBeNull();
  });

  it("rejects a payload signed with another secret (rotated/foreign deployment)", () => {
    expect(verifyTicketPayload(buildTicketPayload(ORDER, SECRET), "another-secret-of-sufficient-length")).toBeNull();
  });

  it("never throws on junk input", () => {
    for (const junk of ["", "   ", null, undefined, "TFN1", "TFN1.ABC", "TFN1.A.B", "TFN1.ABC.SHORT", "XXX.YYY.ZZZ", ".."]) {
      expect(verifyTicketPayload(junk as string, SECRET)).toBeNull();
    }
    expect(verifyTicketPayload("TFN1.ABC.0123456789AB", "")).toBeNull();
  });

  it("refuses to sign with a weak secret or empty order number", () => {
    expect(() => buildTicketPayload(ORDER, "short")).toThrow(/terlalu pendek/);
    expect(() => buildTicketPayload("   ", SECRET)).toThrow(/kosong/);
  });
});
