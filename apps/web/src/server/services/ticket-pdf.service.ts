/**
 * Re-export dari `@tfn/ticketing/pdf`. Implementasi asli ada di
 * `packages/ticketing/src/ticket-pdf.service.ts`.
 *
 * Kenapa dipindah: `apps/api` juga membuat PDF tiket, dan sebelumnya ia mengimpor file ini lewat
 * alias `@/*` → `../web/src/*` — arah dependensi terbalik (API butuh source web untuk deploy).
 */
export * from "@tfn/ticketing/pdf";
