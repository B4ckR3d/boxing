import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/security/password";

describe("Password Security & Authentication", () => {
  it("successfully hashes and verifies passwords using Argon2id", async () => {
    const rawPass = "Demo-Ringside-2026!";
    const hash = await hashPassword(rawPass);
    expect(hash).toContain("$argon2id$");

    const isValid = await verifyPassword(hash, rawPass);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, "WrongPassword123!");
    expect(isInvalid).toBe(false);
  });
});

