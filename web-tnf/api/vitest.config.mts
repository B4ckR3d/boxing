import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Alias di sini HARUS sejalan dengan `tsconfig.json` dan flag esbuild di `package.json`
 * (`build`). Fase strangler: `apps/api` memakai service `apps/web` lewat `@/*`.
 *
 * `server-only` dan `next/headers` dipetakan ke shim karena API tidak punya runtime Next —
 * shim `next/headers` sengaja melempar bila dipanggil, supaya pemanggil yang lupa menyuntik
 * `SessionCookieJar` gagal dengan jelas.
 */
const webSrc = fileURLToPath(new URL("../web/src", import.meta.url));
const shims = fileURLToPath(new URL("./src/shims", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${webSrc}/$1` },
      { find: /^server-only$/, replacement: `${shims}/server-only.ts` },
      { find: /^next\/headers$/, replacement: `${shims}/next-headers.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    testTimeout: 15000,
  },
});
