/**
 * Penjaga arsitektur (Langkah F).
 *
 * `@tfn/auth` adalah paket domain murni: boleh dipakai `apps/api`, worker, dan test. Kalau salah satu
 * berkas di sana mengimpor `next/*`, `server-only`, atau alias internal app, paket kembali mustahil
 * dipakai di luar Next dan restrukturisasi ini regresi tanpa suara.
 *
 * Test ini membaca sumber, bukan menjalankan modul — tetap valid walau isi fungsi berubah.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "packages", "auth", "src");

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return entry.endsWith(".ts") ? [full] : [];
  });
}

const files = tsFiles(SRC);
const rel = (f: string) => f.slice(SRC.length + 1);

describe("batas paket @tfn/auth", () => {
  it("menemukan sumber paket", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("tidak ada berkas yang mengimpor next/* atau server-only", () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /from\s+["']next\/|from\s+["']server-only["']/.test(src);
    });
    expect(offenders.map(rel)).toEqual([]);
  });

  it("tidak ada berkas yang mengimpor alias internal app (@/...)", () => {
    const offenders = files.filter((f) => /from\s+["']@\//.test(readFileSync(f, "utf8")));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("layanan berbasis I/O menerima dependensi lewat parameter", () => {
    for (const name of ["session.service.ts", "rbac.service.ts"]) {
      const src = readFileSync(join(SRC, name), "utf8");
      // Hanya boleh impor TIPE PrismaClient, tidak pernah membuat client sendiri.
      expect(src).toMatch(/import type \{[^}]*PrismaClient[^}]*\} from\s+["']@tfn\/db\/client["']/);
      expect(src).not.toMatch(/new PrismaClient\(/);
    }
  });

  it("rbac.service mengekspor factory, bukan singleton prisma", () => {
    const src = readFileSync(join(SRC, "rbac.service.ts"), "utf8");
    expect(src).toMatch(/export function createRbacService\(/);
    expect(src).not.toMatch(/^export const prisma/m);
  });
});
