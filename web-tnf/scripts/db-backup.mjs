#!/usr/bin/env node
/**
 * MySQL backup helper for `npm run db:backup`.
 *
 *   node scripts/db-backup.mjs                 # → backups/<db>-YYYY-MM-DD_HHMM.sql.gz
 *   node scripts/db-backup.mjs --keep=30       # retention (default 14)
 *   node scripts/db-backup.mjs --out=/www/backup
 *
 * Reads DATABASE_URL first, then falls back to the MYSQL_* variables in .env.
 * The password is passed through MYSQL_PWD so it never shows up in `ps`.
 * Requires `mysqldump` on the box (mariadb-client / mysql-client).
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";

function arg(name, fallback) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

let host = process.env.MYSQL_HOST || "127.0.0.1";
let port = process.env.MYSQL_PORT || "3306";
let user = process.env.MYSQL_USER || "boxing";
let pass = process.env.MYSQL_PASSWORD || "";
let database = process.env.MYSQL_DATABASE || "boxing";

if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    if (u.hostname) host = u.hostname;
    if (u.port) port = u.port;
    if (u.username) user = decodeURIComponent(u.username);
    if (u.password) pass = decodeURIComponent(u.password);
    if (u.pathname) database = u.pathname.replace(/^\//, "");
  } catch {
    console.error("✗ DATABASE_URL is set but could not be parsed — falling back to MYSQL_* vars");
  }
}

const keep = Number(arg("keep", "14"));
const outDir = path.resolve(arg("out", "backups"));
const stamp = new Date().toISOString().replace(/T/, "_").replace(/:/g, "").slice(0, 17);
const target = path.join(outDir, `${database}-${stamp}.sql.gz`);

mkdirSync(outDir, { recursive: true });

console.log(`→ Dumping ${user}@${host}:${port}/${database} → ${target}`);

const dump = spawn(
  "mysqldump",
  [
    `-h${host}`,
    `-P${port}`,
    `-u${user}`,
    "--single-transaction",
    "--quick",
    "--skip-lock-tables",
    "--default-character-set=utf8mb4",
    "--no-tablespaces",
    database,
  ],
  { env: { ...process.env, MYSQL_PWD: pass }, stdio: ["ignore", "pipe", "pipe"] },
);

let stderr = "";
dump.stderr.on("data", (c) => (stderr += c.toString()));
dump.on("error", (err) => {
  console.error(`✗ cannot start mysqldump: ${err.message}`);
  console.error("  Install the client first: apt install mariadb-client  (or mysql-client)");
  process.exit(127);
});

const closed = new Promise((resolve) => dump.on("close", resolve));

try {
  await pipeline(dump.stdout, createGzip({ level: 6 }), createWriteStream(target));
} catch (err) {
  console.error("✗ gzip/write failed:", err.message);
  process.exit(1);
}

const exitCode = await closed;
if (exitCode !== 0) {
  console.error(`✗ mysqldump exited with ${exitCode}`);
  if (stderr.trim()) console.error(stderr.trim().split("\n").slice(0, 5).join("\n"));
  if (stderr.includes("command not found")) {
    console.error("  Install the client first: apt install mariadb-client  (or mysql-client)");
  }
  process.exit(exitCode || 1);
}

const size = statSync(target).size;
console.log(`✓ Backup written: ${target} (${(size / 1024 / 1024).toFixed(2)} MB compressed)`);

if (keep > 0) {
  const files = readdirSync(outDir)
    .filter((f) => f.startsWith(`${database}-`) && f.endsWith(".sql.gz"))
    .map((f) => ({ f, t: statSync(path.join(outDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(keep)) {
    unlinkSync(path.join(outDir, old.f));
    console.log(`  pruned: ${old.f}`);
  }
}
