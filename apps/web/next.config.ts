import type { NextConfig } from "next";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Monorepo: satu file .env tinggal di root repo (dipakai web + api + prisma).
// Next hanya mencari .env di direktori app, jadi root .env dimuat eksplisit di sini —
// next.config dievaluasi sebelum Next membaca environment, jadi berlaku untuk runtime
// maupun inlining NEXT_PUBLIC_* saat build.
loadEnv({ path: path.resolve(import.meta.dirname, "../../.env") });

const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  // Monorepo (Langkah A): lockfile + node_modules berada di root repo (node-linker=hoisted),
  // jadi workspace root Turbopack HARUS root repo — bukan apps/web. Kalau diarahkan ke
  // apps/web, Turbopack menganggap `next` tidak terpasang.
  outputFileTracingRoot: MONOREPO_ROOT,
  // @tfn/db mengirim TypeScript source (Prisma Client 7 digenerate sebagai .ts), bukan hasil
  // build JS — jadi Next harus ikut men-transpile package ini. Tanpa ini, `next build` gagal
  // me-resolve tipe dari workspace package.
  transpilePackages: ["@tfn/db"],
  turbopack: {
    root: MONOREPO_ROOT,
  },
};

export default nextConfig;

