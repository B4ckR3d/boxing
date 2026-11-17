import { createApp } from "./app.js";
import { describeEnvProblem, env, loadedEnvFilePaths } from "./config/env.js";
import { disconnectDatabase, pingDatabase } from "./db/prisma.js";
import { logger } from "./lib/logger.js";

/** Entry point: validasi env → start → graceful shutdown. */
async function main(): Promise<void> {
  let e;
  try {
    e = env();
  } catch (error) {
    // Jangan pakai logger di sini: logger sendiri butuh env yang valid.
    process.stderr.write(`[tfn-api] konfigurasi environment tidak valid: ${describeEnvProblem(error)}\n`);
    process.exit(1);
  }

  const log = logger();

  // Jejak konfigurasi: file .env mana yang dipakai + target DB (tanpa password).
  // Tanpa ini, salah-baca .env sulit dilacak karena default diam-diam "valid".
  log.info(
    {
      envFiles: loadedEnvFilePaths(),
      cwd: process.cwd(),
      db: { host: e.MYSQL_HOST, port: e.MYSQL_PORT, database: e.MYSQL_DATABASE, user: e.MYSQL_USER },
    },
    "config resolved",
  );

  const app = createApp({ checkDb: pingDatabase });

  const server = app.listen(e.API_PORT, e.API_HOST, () => {
    log.info(
      { port: e.API_PORT, host: e.API_HOST, env: e.NODE_ENV },
      "tfn-api listening",
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, "shutting down");
    server.close(() => log.info("http server closed"));
    try {
      await disconnectDatabase();
    } catch (error) {
      log.error({ err: error }, "failed to disconnect prisma");
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    log.error({ err: reason }, "unhandled promise rejection");
  });
  process.on("uncaughtException", (error) => {
    log.fatal({ err: error }, "uncaught exception — exiting");
    process.exit(1);
  });
}

void main();
