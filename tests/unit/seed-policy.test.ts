import { describe, expect, it } from "vitest";
import { getSeedPolicy, getBootstrapAccount } from "../../scripts/account-policy";

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
    expect(getBootstrapAccount({ BOOTSTRAP_ADMIN_EMAIL: "ADMIN@TFN.LOCAL ", BOOTSTRAP_ADMIN_NAME: "TFN Admin", BOOTSTRAP_ADMIN_PASSWORD: "StrongPassword123!" })).toEqual({email: "admin@tfn.local", name: "TFN Admin", password: "StrongPassword123!"});
  });
});
