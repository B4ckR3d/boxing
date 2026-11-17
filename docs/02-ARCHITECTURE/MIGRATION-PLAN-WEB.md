# Migration Plan — Next.js (root) → `apps/web` + modul → `apps/api`

**Status:** 📝 **DRAFT — belum disetujui, belum boleh dieksekusi.**
**Dibuat:** 17 Nov 2026 · **Dasar:** ADR-001 (ACCEPTED), ADR-009 (schema tunggal)

> Aturan: **tidak ada** file aplikasi existing yang dipindah/dihapus sebelum dokumen ini
> disetujui Irhan. Phase 1 hanya menambah `apps/api` di samping app lama.

---

## 1. Kondisi awal (terukur, bukan perkiraan)

| Item | Jumlah | Bukti |
|---|---|---|
| Halaman App Router | 26 `page.tsx` | `find src/app -name page.tsx` |
| Route handler API | 4 | `/api/auth/login`, `/api/auth/logout`, `/api/ticketing/orders`, `/api/ticketing/orders/[orderNumber]` |
| Service layer | 7 file | `src/server/services/*.service.ts` |
| Model Prisma | 40 (29 enum, 3 migration) | `prisma/schema.prisma` |
| LOC TypeScript | ±13.500 | Phase 0 audit |
| Data produksi | demo seed | Phase 0 audit |

Invariant yang **tidak boleh** rusak selama migrasi: reservasi kursi atomik (50 request paralel →
50 kursi, 0 oversell), PDF + QR HMAC, check-in, hold expiry.

---

## 2. Prinsip

1. **Strangler, bukan rewrite.** Satu modul pindah per iterasi, dengan test penjaga yang sudah ada.
2. **Database tetap satu.** Tidak ada schema duplikat (ADR-009). Migration hanya dari root.
3. **UI tetap di Next.** `apps/web` hanya memindahkan *lokasi* kode, bukan mengubah rendering.
4. **Setiap langkah punya rollback** = revert commit; tidak ada langkah yang destruktif.
5. **Gate tiap langkah:** typecheck + lint + unit + integration + build + probe HTTP lulus.

---

## 3. Urutan langkah (usulan)

### Langkah A — Pindahkan app Next ke `apps/web` (tanpa perubahan perilaku)
- **Isi:** `src/`, `public/`, `next.config.ts`, `postcss.config.*`, `tsconfig.json`, `prisma/`…
  dipindah ke `apps/web/`; root jadi workspace murni.
- **Risiko tertinggi** (path, alias `@/*`, Prisma output `src/generated`, cron path,
  Dockerfile, `NEXT_PUBLIC_APP_URL`).
- **Prasyarat:** root `package.json` dipisah (root = orchestrator), turbo pipeline final,
  CI menjalankan `pnpm -w run verify`.
- **Rollback:** satu commit revert; app lama utuh di root sampai langkah ini disetujui.
- **Acceptance:** `next build` di `apps/web` sukses; 26 halaman 200 (probe lama dipakai ulang);
  ticketing 50-parallel tetap 0 oversell.

### Langkah B — Pindahkan auth ke `apps/api`
- Pindah `src/server/services/auth.service.ts`, `rbac.service.ts`, route `/api/auth/*`.
- Cookie sesi lintas subdomain (ADR-002), CSRF tetap.
- **Acceptance:** login/logout via API; unit test auth (sudah ada) pindah & lulus;
  deny-path diuji; halaman admin masih bisa login.

### Langkah C — Pindahkan ticketing
- `ticketing.service.ts`, `ticket-pdf.service.ts`, route `/api/ticketing/*`.
- **Acceptance:** integration test ticketing (50 paralel) + check-in + PDF/QR lulus di API;
  UI memanggil API baru; hold expiry cron pindah ke worker.

### Langkah D — Pindahkan sisanya (`audit`, `settings`, `sponsor`) + worker
- `apps/worker`: expire-holds, notifikasi, sheets sync (TFN-018).
- **Acceptance:** cron berjalan dari worker; log terpusat; tidak ada route handler bisnis
  tersisa di Next (kecuali BFF/proxy bila diputuskan).

### Langkah E — Bersihkan root
- Hapus `src/server`, route handler lama, script duplikat; update semua dokumen.

---

## 4. Yang TIDAK dilakukan di Phase 1

- Membuat `apps/web` (butuh Langkah A disetujui).
- Memindahkan auth/ticketing (butuh Langkah B/C).
- Menambah modul baru di Next.js — modul baru **hanya** di `apps/api`.
- Mengubah schema/enum/migration.

---

## 5. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| `@/*` alias & generated Prisma path rusak saat pindah | build gagal | Langkah A dikerjakan sendiri, tanpa perubahan lain, dengan probe 26 halaman |
| Dua backend membingungkan kontributor | modul baru salah tempat | aturan tertulis di ADR-001 + `AI-CONTEXT/AI-INSTRUCTIONS.md` |
| Cookie lintas subdomain bocor ke domain lain | keamanan | `Domain=.tfn.pimpom.id` + CSRF + uji deny-path (ADR-002) |
| Migration dijalankan dari dua tempat | riwayat pecah | ADR-009: hanya root |
| Ticketing regresi saat pindah | oversell | test 50-parallel wajib lulus sebelum & sesudah |

---

## 5a. Blocker yang ditemukan saat menyiapkan Langkah A (17 Nov 2026)

> **STATUS: SELESAI 17 Nov 2026 — opsi A dipilih dan dijalankan.**
> `packages/db` (`@tfn/db`) menjadi satu-satunya pintu ke Prisma Client; output generator pindah ke
> `packages/db/src/generated/prisma`; 7 impor diarahkan ulang; lalu aplikasi dipindah ke `apps/web`
> (`scripts/monorepo/apply-move-web.sh`, bukan `git mv src apps/web/src`).
> Bukti: `pnpm turbo:verify` 9/9 sukses, `apps/web` 105 test lulus, `next build` sukses,
> probe 26 halaman via `next start` — 200/307 sesuai harapan. Lihat CHANGELOG 2026-11-17 dan ADR-011/012.
> Catatan tambahan di luar rencana awal: `turbopack.root` harus root repo (bukan `apps/web`), `.env`
> root harus dimuat eksplisit oleh `next.config.ts`, dan esbuild butuh `--alias` untuk `@tfn/db`.

`src/generated/prisma` (hasil `prisma generate`, **gitignored**) berada **di dalam** `src/` —
padahal `src/app`, `src/components`, `src/lib`, `src/server`, `src/proxy.ts`, `src/styles` adalah
milik app Next.js yang harus pindah ke `apps/web`. Prisma Client itu dipakai **bersama** web dan
`apps/api` (`@/generated/prisma` di 5 file web + 1 file `apps/api`).

Konsekuensi: Langkah A **tidak bisa** dijalankan sebagai `git mv src apps/web/src`. Harus pilih
satu dulu:

| Opsi | Isi | Biaya | Catatan |
|---|---|---|---|
| **A (rekomendasi)** | `packages/db` memiliki client; output generator → `packages/db/src/generated`; kedua app impor `@tfn/db` | rewrite 6 impor + package baru | Paling benar jangka panjang; schema tetap satu di root (ADR-009) |
| B | Biarkan di `src/generated`, `apps/web` diberi alias khusus | 0 rewrite | Rapuh: dua alias berbagi prefix `@/`, mudah salah resolve |
| C | Output pindah ke `<root>/generated/prisma` | rewrite 6 impor | Minim, tapi root makin berisi artefak build |

Rencana kering (dry run, **tidak** mengubah apa pun): `node scripts/monorepo/plan-move-web.mjs`.

---

## 6. Keputusan yang dibutuhkan dari Irhan

1. Setujui **Langkah A** (pindah app Next ke `apps/web`) — kapan?
2. Nama paket web: `@tfn/web` (usulan) — cocok?
3. Apakah Next tetap menjadi BFF (proxy ke API) atau FE memanggil API langsung dari browser?
4. Worker: proses terpisah `apps/worker` (usulan) atau cron di dalam API?

Sampai pertanyaan di atas dijawab, pekerjaan berhenti di Phase 1 (fondasi).
