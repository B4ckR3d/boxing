import type { NextConfig } from "next";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Project mandiri: `.env` tinggal di folder ini (bukan lagi di root monorepo).
// next.config dievaluasi sebelum Next membaca environment, jadi pemuatan ini berlaku untuk
// runtime maupun inlining NEXT_PUBLIC_* saat build.
const PROJECT_ROOT = import.meta.dirname;
loadEnv({ path: path.resolve(PROJECT_ROOT, ".env") });

const nextConfig: NextConfig = {
  // node_modules ada di root project ini (node-linker=hoisted), jadi workspace root Turbopack
  // harus folder ini juga — bukan packages/*.
  outputFileTracingRoot: PROJECT_ROOT,
  // @tfn/db dkk mengirim TypeScript source (Prisma Client 7 digenerate sebagai .ts), bukan hasil
  // build JS — Next harus ikut men-transpile paket-paket ini.
  transpilePackages: ["@tfn/db", "@tfn/ticketing", "@tfn/core", "@tfn/auth"],
  turbopack: {
    root: PROJECT_ROOT,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "logo.clearbit.com" }],
  },
};

export default nextConfig;
