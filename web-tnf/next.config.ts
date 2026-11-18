import type { NextConfig } from "next";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Project mandiri: `.env` tinggal di folder ini (bukan lagi di root monorepo).
// next.config dievaluasi sebelum Next membaca environment, jadi pemuatan ini berlaku untuk
// runtime maupun inlining NEXT_PUBLIC_* saat build.
const PROJECT_ROOT = import.meta.dirname;
loadEnv({ path: path.resolve(PROJECT_ROOT, ".env") });

function buildAllowedActionOrigins(): string[] {
  const hosts = new Set<string>(["localhost:3000", "localhost:9002", "127.0.0.1:3000", "127.0.0.1:9002"]);
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (parsed.host) hosts.add(parsed.host);
    } catch {
      // Abaikan jika APP_URL belum valid
    }
  }
  return [...hosts];
}

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
  experimental: {
    serverActions: {
      // Di balik reverse proxy aaPanel/Nginx, header Host internal bisa berupa localhost:9002
      // sementara Origin browser adalah domain publik (mis. tfn.pimpom.id).
      allowedOrigins: buildAllowedActionOrigins(),
      bodySizeLimit: "10mb",
    },
  },
  images: {
    localPatterns: [{ pathname: "/**" }],
    remotePatterns: [{ protocol: "https", hostname: "logo.clearbit.com" }],
  },
};

export default nextConfig;
