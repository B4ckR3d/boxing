/**
 * Smoke test artefak produksi (`dist/index.js`).
 *
 * Kenapa ada: bug nyata pernah lolos seluruh gate (typecheck, lint, unit test, `tsx` dev) lalu
 * muncul HANYA di bundle — `import.meta.url` berpindah ke `dist/`, pencarian `.env` meleset,
 * service diam-diam memakai default dan `/health/ready` balas 503. Karena itu artefak hasil
 * `build` wajib dijalankan sungguhan, bukan hanya dikompilasi.
 *
 * Sengaja dijalankan dari `cwd` sementara (bukan apps/api) untuk menguji jalur fallback.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const entry = path.join(apiRoot, "dist", "index.js");
const PORT = Number(process.env.SMOKE_PORT ?? 4123);
const BASE = `http://127.0.0.1:${PORT}`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(entry)) fail(`artefak belum ada: ${entry} — jalankan "pnpm build" dulu`);

const child = spawn(process.execPath, [entry], {
  cwd: tmpdir(),
  env: { ...process.env, API_PORT: String(PORT), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

const started = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout menunggu 'listening' (10s)")), 10_000);
  child.stdout.on("data", (chunk) => {
    if (String(chunk).includes("listening")) {
      clearTimeout(timer);
      resolve();
    }
  });
  child.on("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`proses keluar lebih awal (exit ${code}): ${stderr.slice(0, 400)}`));
  });
});

async function get(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  return { status: res.status, body: await res.text() };
}

try {
  await started;

  const health = await get("/health");
  if (health.status !== 200) fail(`/health → ${health.status}, harap 200`);

  const ready = await get("/health/ready");
  if (ready.status !== 200) {
    fail(`/health/ready → ${ready.status} (harap 200). Body: ${ready.body.slice(0, 200)}`);
  }
  if (!ready.body.includes('"database":"up"')) fail(`/health/ready tidak melaporkan database up: ${ready.body}`);

  const notFound = await get("/tidak-ada");
  if (notFound.status !== 404) fail(`/tidak-ada → ${notFound.status}, harap 404`);
  if (!/"code":"NOT_FOUND"/.test(notFound.body)) fail(`envelope error tidak standar: ${notFound.body}`);

  console.log(`✓ dist smoke: /health 200, /health/ready 200 (database up), 404 envelope standar — port ${PORT}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (child.exitCode === null) child.kill("SIGKILL");
}
