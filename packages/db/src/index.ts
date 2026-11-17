/**
 * `@tfn/db` — satu-satunya pintu masuk ke Prisma Client (ADR-011).
 *
 * Kenapa package ini ada: schema Prisma tetap **satu** di `prisma/schema.prisma` (root),
 * tapi hasil generate-nya dulu berada di `src/generated/prisma` — yaitu di dalam folder
 * milik app Next.js. Itu membuat app Next tidak bisa dipindah ke `apps/web` tanpa memutus
 * `apps/api`, dan membuat `tsc` gagal emit (file di luar `rootDir`).
 *
 * Sekarang client digenerate ke `packages/db/src/generated/prisma` dan diimpor lewat package
 * ini oleh **semua** consumer (web, api, script, seed). Jangan pernah mengimpor
 * `generated/prisma/...` secara langsung dari app — selalu lewat subpath di bawah.
 *
 * Titik masuk yang tersedia:
 *   `@tfn/db`          → PrismaClient + tipe + enum (re-export penuh)
 *   `@tfn/db/client`   → PrismaClient, namespace `Prisma`
 *   `@tfn/db/enums`    → enum skema (mis. TicketOrderStatus)
 */
export * from "./generated/prisma/client.js";
export * from "./generated/prisma/enums.js";
