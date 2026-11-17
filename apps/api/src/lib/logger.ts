import pino, { type Logger } from "pino";
import { env } from "../config/env.js";

/**
 * Logger JSON terstruktur (pino). Semua modul memakai instance ini —
 * jangan pakai console.* (ditegakkan aturan eslint `no-console`).
 */
let instance: Logger | null = null;

export function logger(): Logger {
  if (instance) return instance;
  const e = env();
  instance = pino({
    level: e.LOG_LEVEL,
    base: { service: "tfn-api", env: e.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-api-key"]',
        "res.headers['set-cookie']",
        "*.password",
        "*.token",
        "*.secret",
      ],
      censor: "[redacted]",
    },
  });
  return instance;
}

/** Hanya untuk test. */
export function resetLogger(): void {
  instance = null;
}
