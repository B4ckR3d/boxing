import { afterEach, describe, expect, it } from "vitest";
import { describeEnvProblem, env, resetEnvCache } from "../src/config/env.js";

const TOUCHED = [
  "DATABASE_URL",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "LOG_LEVEL",
  "API_PORT",
];

const original = Object.fromEntries(TOUCHED.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of TOUCHED) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  resetEnvCache();
});

describe("env()", () => {
  it("mengisi field MYSQL_* dari DATABASE_URL", () => {
    delete process.env.MYSQL_PORT;
    delete process.env.MYSQL_DATABASE;
    process.env.DATABASE_URL = "mysql://api_user:rahasia@db.internal:3310/tfn_prod";
    resetEnvCache();

    const e = env();
    expect(e.MYSQL_HOST).toBe("db.internal");
    expect(e.MYSQL_PORT).toBe(3310);
    expect(e.MYSQL_DATABASE).toBe("tfn_prod");
    expect(e.MYSQL_USER).toBe("api_user");
    expect(e.MYSQL_PASSWORD).toBe("rahasia");
  });

  it("memecah CORS_ORIGINS menjadi array", () => {
    process.env.CORS_ORIGINS = "http://a.test, https://b.test ,";
    resetEnvCache();

    expect(env().corsOrigins).toEqual(["http://a.test", "https://b.test"]);
  });

  it("menolak LOG_LEVEL yang tidak dikenal (fail fast)", () => {
    process.env.LOG_LEVEL = "verbose";
    resetEnvCache();

    expect(() => env()).toThrow();
    try {
      env();
    } catch (error) {
      expect(describeEnvProblem(error)).toContain("LOG_LEVEL");
    }
  });
});
