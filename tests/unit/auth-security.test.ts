import { beforeEach, describe, expect, it, vi } from "vitest";
import { totp } from "@/lib/security/totp";

const mocks = vi.hoisted(() => ({
  cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  session: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  loginAttempt: { create: vi.fn() },
  verifyPassword: vi.fn(),
  config: { AUTH_ENFORCE_MFA: true, AUTH_MAX_FAILED_LOGINS: 5, AUTH_LOCKOUT_MINUTES: 15, SESSION_TTL_HOURS: 12, SESSION_IDLE_MINUTES: 60, ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") },
}));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookies }));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks }));
vi.mock("@/lib/env", () => ({ env: () => mocks.config }));
vi.mock("@/lib/security/password", () => ({ verifyPassword: mocks.verifyPassword, verifyAgainstDummy: vi.fn() }));
vi.mock("@/server/services/audit.service", () => ({ logAudit: vi.fn() }));
import { authenticateCredentials } from "@/server/services/auth.service";
import { encryptSecret } from "@/lib/security/crypto";

const secret = "JBSWY3DPEHPK3PXP";
function user(overrides = {}) {
  return { id: "user-1", email: "admin@example.com", name: "Admin", isActive: true, passwordHash: "hash", failedLoginCount: 0, lockedUntil: null, mfaEnabled: true, mfaSecretEnc: encryptSecret(secret), roles: [{ role: { key: "admin", requiresMfa: true, permissions: [{ permission: { key: "admin.access" } }] } }], ...overrides };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.AUTH_ENFORCE_MFA = true;
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.user.findUnique.mockResolvedValue(user());
  mocks.session.create.mockResolvedValue({ id: "session-1" });
});

describe("MFA session boundary", () => {
  it("does not report success or issue a fake token before MFA validation", async () => {
    const result = await authenticateCredentials("admin@example.com", "password");
    expect(result.success).toBe(false);
    expect(result.requiresMfa).toBe(true);
    expect(result).not.toHaveProperty("tempToken");
    expect(mocks.session.create).not.toHaveBeenCalled();
    expect(mocks.user.update).not.toHaveBeenCalled();
    expect(mocks.loginAttempt.create).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ success: true }) }));
  });
  it("fails closed when a role requires MFA but enrollment is missing", async () => {
    mocks.user.findUnique.mockResolvedValue(user({ mfaEnabled: false, mfaSecretEnc: null }));
    const result = await authenticateCredentials("admin@example.com", "password");
    expect(result.success).toBe(false);
    expect(mocks.session.create).not.toHaveBeenCalled();
  });
  it("creates an MFA-verified session only with a valid encrypted-secret TOTP", async () => {
    const result = await authenticateCredentials("admin@example.com", "password", { totpCode: totp(secret) });
    expect(result.success).toBe(true);
    expect(result.user?.mfaVerified).toBe(true);
    expect(mocks.session.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mfaVerified: true }) }));
  });
  it("counts invalid MFA attempts without creating a session", async () => {
    const result = await authenticateCredentials("admin@example.com", "password", { totpCode: "bad-code" });
    expect(result.success).toBe(false);
    expect(mocks.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginCount: 1 }) }));
    expect(mocks.session.create).not.toHaveBeenCalled();
  });
  it("fails closed for a damaged encrypted MFA secret", async () => {
    mocks.user.findUnique.mockResolvedValue(user({ mfaSecretEnc: "damaged" }));
    const result = await authenticateCredentials("admin@example.com", "password", { totpCode: "123456" });
    expect(result.success).toBe(false);
    expect(mocks.session.create).not.toHaveBeenCalled();
  });
  it("requires enrolled MFA even if role enforcement is disabled", async () => {
    mocks.config.AUTH_ENFORCE_MFA = false;
    const result = await authenticateCredentials("admin@example.com", "password");
    expect(result.success).toBe(false);
    expect(mocks.session.create).not.toHaveBeenCalled();
  });
  it("allows an unenrolled role-required development account when enforcement is disabled", async () => {
    mocks.config.AUTH_ENFORCE_MFA = false;
    mocks.user.findUnique.mockResolvedValue(user({ mfaEnabled: false, mfaSecretEnc: null }));
    const result = await authenticateCredentials("admin@example.com", "password");
    expect(result.success).toBe(true);
    expect(result.user?.mfaVerified).toBe(false);
  });
});
