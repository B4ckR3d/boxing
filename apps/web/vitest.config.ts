import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = {
  "server-only": path.resolve(import.meta.dirname, "./tests/mocks/server-only.ts"),
  "@": path.resolve(import.meta.dirname, "./src"),
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          globals: true,
          environment: "node",
          setupFiles: ["tests/setup.ts"],
          include: ["tests/unit/**/*.test.ts"],
          alias,
        },
      },
      {
        test: {
          name: "integration",
          globals: true,
          environment: "node",
          setupFiles: ["tests/setup.ts"],
          include: ["tests/integration/**/*.test.ts"],
          alias,
          /**
           * Serial, bukan paralel. Semua file integrasi memakai **satu** database MySQL yang sama,
           * dan beberapa di antaranya memanggil `expireStaleHolds()` yang bersifat global: sapuan itu
           * mengambil batch `take: 200` lintas event, lalu men-CANCEL order milik file tes lain yang
           * sedang berjalan. Gejalanya flaky (~1 dari 3 run) di `buyer-cap`, bukan di tes konkurensi —
           * order "basi" milik file itu sudah dihabiskan sapuan file lain sebelum gilirannya.
           *
           * Biaya: suite integrasi ~3 detik lebih lambat. Itu harga yang wajar untuk gate deterministik;
           * gate yang kadang hijau kadang merah tidak bisa dipakai sebagai pembanding pemindahan.
           */
          fileParallelism: false,
        },
      },
    ],
  },
});
