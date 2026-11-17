#!/usr/bin/env node
/**
 * DRY RUN perencana Langkah A (memindahkan app Next.js ke `apps/web`).
 *
 * Script ini HANYA membaca dan mencetak rencana — tidak memindahkan, tidak menghapus, tidak
 * menulis file apa pun. Eksekusi nyata menunggu persetujuan pemilik repo.
 *
 * Klasifikasi sengaja konservatif: apa pun yang tidak jelas kepemilikannya masuk "SHARED/PERIKSA",
 * bukan otomatis ikut pindah.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "../..");

/** Milik app Next.js → pindah ke apps/web/. */
const WEB = [
  "src/app",
  "src/components",
  "src/lib",
  "src/proxy.ts",
  "src/server",
  "src/styles",
  "public",
  "tests",
  "next.config.ts",
  "next-env.d.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "eslint.config.mjs",
  "vitest.config.ts",
  "storage",
];

/**
 * Terjebak di dalam `src/` tapi BUKAN milik web: Prisma Client hasil generate (gitignored).
 * Dipakai bersama oleh app Next.js **dan** `apps/api`. Tidak boleh ikut pindah begitu saja —
 * ini blocker Langkah A yang harus diputuskan lebih dulu (lihat bagian BLOCKER di output).
 */
const GENERATED = ["src/generated/prisma"];

/** Dipakai bersama root app + apps/api + tooling → TETAP di root (jangan dipindah). */
const SHARED = [
  "prisma",
  "docs",
  "scripts",
  "docker",
  "backups",
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "turbo.json",
  "prisma.config.ts",
  "docker-compose.yml",
  "AGENTS.md",
  "README.md",
  "CHANGELOG.md",
  "prd.md",
  ".env",
  ".env.example",
  ".npmrc",
  ".gitignore",
];

/** Sisa artefak build / lockfile asing → dibuang saat eksekusi (bukan dipindah). */
const DROP = [".next", "tsconfig.tsbuildinfo", ".turbo", "package-lock.json"];

const entries = readdirSync(repo).filter((n) => !["node_modules", ".git", ".hermes", "apps"].includes(n));
const known = new Set([...WEB, ...SHARED, ...DROP, "src"]);
const unknown = entries.filter((n) => !known.has(n));

const plan = [];
for (const name of WEB) {
  const abs = path.join(repo, name);
  let kind;
  try {
    kind = statSync(abs).isDirectory() ? "dir" : "file";
  } catch {
    kind = "MISSING";
  }
  plan.push({ action: "git mv", name, kind });
}

console.log("=== LANGKAH A (DRY RUN) — rencana pemindahan ke apps/web ===\n");
console.log(`repo: ${repo}\n`);

console.log("PINDAH ke apps/web/  (git mv, riwayat tetap):");
for (const p of plan) {
  const to = p.kind === "MISSING" ? "(tidak ada, dilewati)" : `apps/web/${p.name}`;
  console.log(`  ${p.name.padEnd(22)} -> ${to}`);
}

console.log("\nTETAP di root (dipakai bersama / tooling):");
console.log("  " + SHARED.join(", "));

console.log("\nDIBUANG saat eksekusi (artefak, bukan source):");
console.log("  " + DROP.join(", "));

console.log("\nBLOCKER — jangan dipindah otomatis:");
for (const g of GENERATED) console.log(`  ${g}  (dipakai bersama web + apps/api, gitignored)`);
console.log(`
  Impor ke Prisma Client ada di 5 file web + 1 file apps/api ("@/generated/prisma").
  Pilih SATU lebih dulu, kalau tidak Langkah A akan memutus salah satu sisi:`);
console.log(`
  A) packages/db (REKOMENDASI): generator output -> packages/db/src/generated,
     kedua app impor "@tfn/db". Rewrite 6 impor, schema tetap di root (ADR-009).
  B) Biarkan di src/generated, apps/web ditambah alias khusus (rapuh: dua alias
     berbagi prefix "@/", mudah salah resolve).
  C) Pindah output ke <root>/generated/prisma, rewrite 6 impor, tanpa package baru
     (paling minim, tapi root makin berisi artefak build).`);

if (unknown.length > 0) {
  console.log("\n⚠️  TIDAK DIKENALI — periksa manual sebelum eksekusi:");
  for (const name of unknown) console.log(`  ${name}`);
}

console.log(`
Risiko yang wajib ditutup pada commit pemindahan:
  1. Alias "@/..." di tsconfig harus tetap menunjuk src/ milik apps/web.
  2. Impor Prisma Client ke ../../src/generated/prisma (root) harus tetap resolve —
     atau diganti ke jalur absolut package setelah packages/db ada (ADR-009).
  3. next.config.ts: pastikan tidak ada path relatif ke prisma/ atau public/ yang berubah.
  4. Script root (dev/build/test) harus diarahkan ke --filter @tfn/web, bukan dijalankan di root.
  5. Verifikasi: 26 halaman + API route ticketing (uji 50-paralel) + vitest unit/integration.

Tidak ada perubahan yang dilakukan oleh script ini.
`);
