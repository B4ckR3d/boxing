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
        },
      },
    ],
  },
});
