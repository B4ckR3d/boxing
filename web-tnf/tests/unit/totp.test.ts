import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  totp,
  verifyTotp,
  totpUri,
} from "@/lib/security/totp";

describe("RFC 6238 TOTP Engine", () => {
  it("encodes and decodes base32 symmetrically", () => {
    const raw = Buffer.from("boxing-championship-secret-key-1234");
    const encoded = base32Encode(raw);
    const decoded = base32Decode(encoded);
    expect(decoded.toString()).toBe(raw.toString());
  });

  it("generates a random base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it("generates and verifies a valid TOTP code", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const code = totp(secret, now);
    expect(code).toMatch(/^\d{6}$/);

    const isValid = verifyTotp(secret, code, now);
    expect(isValid).toBe(true);
  });

  it("tolerates clock drift within window = 1 (±30s)", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const codePast = totp(secret, now - 25_000); // 25s in the past
    expect(verifyTotp(secret, codePast, now, 1)).toBe(true);

    const codeFuture = totp(secret, now + 25_000); // 25s in future
    expect(verifyTotp(secret, codeFuture, now, 1)).toBe(true);
  });

  it("rejects codes outside the drift window", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const codeWayPast = totp(secret, now - 120_000); // 2 minutes ago
    expect(verifyTotp(secret, codeWayPast, now, 1)).toBe(false);
  });

  it("constructs compliant otpauth URI", () => {
    const uri = totpUri("JBSWY3DPEHPK3PXP", "admin@boxing.local", "WBC-X");
    expect(uri).toContain("otpauth://totp/WBC-X%3Aadmin%40boxing.local");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=WBC-X");
  });
});

