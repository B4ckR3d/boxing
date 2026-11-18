import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm exec tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL || "mysql://boxing:5sCSMIiwKWUNgHd8e6LrBX30@127.0.0.1:3307/boxing",
  },
});
