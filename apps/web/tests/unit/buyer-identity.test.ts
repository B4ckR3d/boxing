import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone, sameEmail, samePhone } from "@/lib/ticketing/buyer-identity";

describe("buyer identity normalisation", () => {
  it("lowercases and trims emails", () => {
    expect(normalizeEmail("  Rina@Example.COM ")).toBe("rina@example.com");
    expect(sameEmail("Rina@Example.com", " rina@example.com ")).toBe(true);
    expect(sameEmail("rina@example.com", "rina+2@example.com")).toBe(false);
    expect(sameEmail("", "")).toBe(false);
  });

  it("collapses every common Indonesian phone spelling onto one canonical form", () => {
    const variants = ["+62 812-3456-7890", "62812 3456 7890", "812 3456 7890", "0812 3456 7890", "(0812) 3456-7890"];
    for (const variant of variants) expect(normalizePhone(variant)).toBe("081234567890");
  });

  it("matches across spellings but not across different numbers", () => {
    expect(samePhone("+62 812-3456-7890", "081234567890")).toBe(true);
    expect(samePhone("081234567890", "081234567891")).toBe(false);
  });

  it("never treats empty or junk phones as the same buyer", () => {
    expect(samePhone("", "")).toBe(false);
    expect(samePhone("abc", "abc")).toBe(false);
    expect(samePhone("12345", "12345")).toBe(false); // too short to trust as identity
    expect(normalizePhone("abc")).toBe("");
  });

  it("keeps landline/021 numbers stable", () => {
    expect(normalizePhone("+62 21 555 1234")).toBe("0215551234");
    expect(samePhone("021-555-1234", "+62215551234")).toBe(true);
  });
});
