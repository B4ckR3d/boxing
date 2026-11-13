import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("server environment secrets", () => {
  it("rejects missing auth secret instead of using a known fallback", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    const { env } = await import("@/lib/env");
    expect(() => env()).toThrow(/AUTH_SECRET/);
  });
  it("rejects invalid AES key instead of using a known fallback", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "not-a-32-byte-key");
    const { env } = await import("@/lib/env");
    expect(() => env()).toThrow(/ENCRYPTION_KEY/);
  });
});
