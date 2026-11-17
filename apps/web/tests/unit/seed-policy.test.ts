import { describe, expect, it } from "vitest";
import { getSeedPolicy, getBootstrapAccount } from "@/lib/security/account-policy";

describe("seed policy", () => {
  it("refuses demo data and users in production", () => {
    expect(() => getSeedPolicy({ NODE_ENV: "production", SEED_DEMO: "true" })).toThrow(/production/);
    expect(() => getSeedPolicy({ NODE_ENV: "production", SEED_DEMO_USERS: "true", DEMO_USER_PASSWORD: "StrongPassword123!" })).toThrow(/production/);
  });
  it("does not seed demo accounts by default", () => {
    expect(getSeedPolicy({})).toEqual({ demo: false, demoUsers: false, password: undefined });
  });
  it("requires explicit strong password for demo users", () => {
    expect(() => getSeedPolicy({ SEED_DEMO_USERS: "true" })).toThrow(/password/i);
    expect(() => getSeedPolicy({ SEED_DEMO_USERS: "true", DEMO_USER_PASSWORD: "short" })).toThrow(/password/i);
    expect(getSeedPolicy({ SEED_DEMO_USERS: "true", DEMO_USER_PASSWORD: "StrongPassword123!" }).demoUsers).toBe(true);
  });
});

describe("bootstrap account policy", () => {
  it("requires explicit credentials and never falls back to demo accounts", () => {
    expect(() => getBootstrapAccount({})).toThrow();
    expect(() => getBootstrapAccount({ DEMO_USER_PASSWORD: "StrongPassword123!" })).toThrow();
  });
  it("normalizes email and accepts one explicit account", () => {
    expect(getBootstrapAccount({ BOOTSTRAP_ADMIN_EMAIL: "ADMIN@TFN.LOCAL ", BOOTSTRAP_ADMIN_NAME: "TFN Admin", BOOTSTRAP_ADMIN_PASSWORD: "StrongPassword123!" })).toEqual({username: "admin", email: "admin@tfn.local", name: "TFN Admin", password: "StrongPassword123!"});
  });
  it("derives username from email when not given, sanitizing unsupported characters", () => {
    // `+` tidak sah pada username, jadi diganti `-`; pemisah di ujung dibuang.
    expect(
      getBootstrapAccount({
        BOOTSTRAP_ADMIN_EMAIL: "super.admin+tfn@tfn.local",
        BOOTSTRAP_ADMIN_NAME: "TFN Admin",
        BOOTSTRAP_ADMIN_PASSWORD: "StrongPassword123!",
      }).username,
    ).toBe("super.admin-tfn");
  });
  it("prefers an explicit BOOTSTRAP_ADMIN_USERNAME", () => {
    expect(
      getBootstrapAccount({
        BOOTSTRAP_ADMIN_EMAIL: "admin@tfn.local",
        BOOTSTRAP_ADMIN_USERNAME: "  RootOperator  ",
        BOOTSTRAP_ADMIN_NAME: "TFN Admin",
        BOOTSTRAP_ADMIN_PASSWORD: "StrongPassword123!",
      }).username,
    ).toBe("rootoperator");
  });
  it("rejects a username that cannot be derived into a valid handle", () => {
    expect(() =>
      getBootstrapAccount({
        BOOTSTRAP_ADMIN_EMAIL: "ab@tfn.local",
        BOOTSTRAP_ADMIN_NAME: "TFN Admin",
        BOOTSTRAP_ADMIN_PASSWORD: "StrongPassword123!",
      }),
    ).toThrow(/BOOTSTRAP_ADMIN_USERNAME/);
  });
});
