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

> **Progres 17 Nov 2026 — Langkah B SELESAI (3/3):** `/api/auth/*` di web adalah proxy tipis ke
> `apps/api`; tidak ada lagi auth yang dieksekusi di Next. Bukti hidup: login 200 + cookie HttpOnly,
> `/me` 24 permission, logout → 401, `/admin` 200 dengan sesi API vs 307 tanpa sesi, origin asing 403.
> Gate 12/12; web 119 test. Berikutnya: Langkah C.
>
> **Progres 17 Nov 2026 — slice 2/3 SELESAI:** auth sudah hidup di `apps/api`
> (`POST /api/auth/login|logout`, `GET /api/auth/me`) memakai service yang sama dengan web lewat
> `createExpressCookieJar`. Bukti hidup: login 200 + `Set-Cookie` HttpOnly, `/me` 24 permission,
> logout → `/me` 401. Test API 31/31; `turbo:verify` 12/12. Tidak ada duplikasi logika auth.
> Sisa: slice 3/3 (BFF Next → `/api/auth/*`, halaman admin, uji deny-path, hapus route lama).
>
> **Progres 17 Nov 2026 — slice 1/3 SELESAI:** `auth.service` sudah lepas dari `next/headers`
> lewat `SessionCookieJar` (`src/lib/auth/session-cookie-jar.ts`), dengan bukti 4 unit test yang
> membuat `cookies()` melempar bila dipanggil. Sisa: (2) jar Express + route `/api/auth/*` di
> `apps/api`, (3) BFF Next + halaman admin + uji deny-path. Detail: CHANGELOG 2026-11-17.

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

**Status: SELESAI (2026-11-17), dengan 2 catatan.** Hasil nyata:

| Isi | Keadaan |
|---|---|
| `packages/core` | `audit`, `settings`, `sponsor` + `redact`/`setting-schemas`/`sponsor-tiers` |
| Binding web | `apps/web/src/server/services/*` jadi re-export tipis; call site tak berubah |
| Route API | `GET`/`PUT /api/settings` (butuh `settings.manage`), `GET /api/sponsors` (publik) |
| Admin action | proxy ke `PUT /api/settings`; Prisma tak lagi ditulis dari proses Next |
| Worker | `apps/worker` CLI `expire-holds` menggantikan `scripts/expire-holds.ts` |

Bukti cron hidup: `scanned=1 expired=1 seatsReleased=2`, order `PENDING_CONFIRMATION` →
`CANCELLED`, `sold` 5 → 3 (hold di-backdate 30 jam agar benar-benar basi).

**Catatan 1 — notifikasi & sheets sync tidak dikerjakan.** Keduanya belum punya kode sama
sekali; plan hanya menyebutnya sebagai TFN-018. Tidak ada yang bisa dipindah.

**Catatan 2 — `saveTicketTypeAction` masih menyentuh `prisma` langsung** di web (sisa Langkah C),
jadi kalimat "tidak ada route handler bisnis tersisa di Next" belum sepenuhnya benar.

**Bug yang ditemukan gate saat Langkah D, bukan direncanakan:** bundel `apps/api` rusak sejak
Langkah C. `--packages=external` tanpa alias `@tfn/ticketing` membuat `dist/` mengimpor `.ts`
mentah; tak pernah ketahuan karena yang diuji `tsx`, bukan `dist`. Kini `verify:dist` lulus.

### Langkah E — Bersihkan root — **SELESAI (E1 + E2, 2026-11-17)**
- Hapus `src/server`, route handler lama, script duplikat; update semua dokumen.
- **Status: E1 SELESAI, E2 SELESAI.** `src/` di root sudah tidak ada sejak Langkah A.
  - E1: `packages/auth` (`@tfn/auth`) dibuat; `catalog`, `password`, `account-policy`, `rate-limit`,
    `hasPermission`/four-eyes pindah ke sana. `apps/api` tidak lagi memakai alias `@/` untuk tiga
    modul itu, root `tsconfig.json` kehilangan `paths @/* → apps/web/src/*`, dan `scripts/monorepo/*`
    (tooling sekali pakai Langkah A) dihapus.
  - E2: `session.service.ts` → `createAuthService(deps)` di `packages/auth`, bersama `crypto.ts` dan
    `totp.ts`. `apps/web` dan `apps/api` kini binding tipis; **alias `@/*` di `apps/api` dihapus
    seluruhnya**, bersama `tsconfig.dev.json` dan `src/shims/`. Tidak ada lagi impor dari `apps/api`
    ke pohon sumber Next — arah dependensi satu arah: `apps → packages`.
  - Catatan desain: paket menerima `env: () => AuthEnv` (getter), **bukan** objek, supaya konfigurasi
    dibaca per panggilan seperti sebelumnya. `apps/api/src/config/env.ts` mewajibkan `ENCRYPTION_KEY`.

### Langkah F — `server/services` tinggal binding — **SELESAI (2026-11-17)**

Tujuan: tidak ada lagi aturan bisnis di dalam `apps/web`. Setelah audit, folder
`apps/web/src/server/services/` berisi 7 berkas dan hanya **satu** yang masih logika nyata:

| Berkas | Baris | Keputusan |
|---|---|---|
| `rbac.service.ts` | 578 | **pindah** → `packages/auth` sebagai `createRbacService({ db, audit })` |
| `audit`, `auth`, `settings`, `sponsor`, `ticketing`, `ticket-pdf` | < 60 | tetap — memang binding `next/headers` / Prisma web |

- Keenam berkas sisanya **bukan sisa migrasi** yang terlewat, melainkan adapter proses web: yang
  dibaca `headers()` tidak mungkin hidup di paket bersama.
- Dependensi RBAC disuntik (`db` + `audit`), semua 21 ekspor lama dipertahankan, sehingga call site
  (`actions.ts`, `page.tsx`, `RoleManager`, `UserManager`) tidak berubah.
- `apps/api/tests/package-boundary.test.ts` menjaga batas paket: gagal bila `packages/auth/src`
  mengimpor `next/*`, `server-only`, alias `@/…`, atau membuat `new PrismaClient()` sendiri.
- Bukti paket benar-benar portabel: `createRbacService` dijalankan lewat `tsx` di luar Next terhadap
  DB dev → 8 role / 8 user / 71 permission, plus `RbacError` dan `ZodError` pada jalur gagal.

---

### Langkah G — otorisasi RBAC pindah ke `apps/api` — **SELESAI (2026-11-17)**

Langkah F memindahkan *logika* RBAC ke `packages/auth`, tetapi **pemanggilnya** masih proses web:
`apps/web/src/server/services/rbac.service.ts` membuat Prisma client sendiri. Artinya otorisasi
masih berjalan di dua proses. Langkah G memindahkan **jalur HTTP**-nya.

| Endpoint baru di `apps/api` | Penjaga |
|---|---|
| `GET /api/rbac/roles`, `POST /api/rbac/roles` | sesi + `roles.manage` + origin |
| `PUT /api/rbac/roles/:id`, `PUT /api/rbac/roles/:id/permissions`, `DELETE /api/rbac/roles/:id` | sesi + `roles.manage` + origin |
| `GET /api/rbac/users`, `POST /api/rbac/users/:id/roles`, `DELETE /api/rbac/users/:id/roles/:roleId` | sesi + `users.manage` + origin |
| `POST /api/rbac/users/:id/active` | sesi + `users.manage` + origin |
| `GET /api/rbac/role-requests`, `POST /api/rbac/role-requests/:id/review` | sesi + `roles.manage` + origin |

Permission sengaja **dipisah dua**, bukan satu gerbang global: role & role-request dijaga
`roles.manage`, user & pemberian role dijaga `users.manage`. Kalau disatukan, pemegang `users.manage`
bisa menaikkan hak akses sendiri lewat role sensitif — eskalasi wewenang.

- `apps/api/src/lib/require-permission.ts` dipakai bersama settings/sponsor/ticketing, jadi matriks
  permission tidak diduplikasi. Four-eyes tetap di `packages/auth`, bukan di router.
- `apps/web/src/lib/api/rbac.ts` meneruskan **cookie sesi + origin asli**; binding web lama
  (`server/services/rbac.service.ts`, 578 baris) **dihapus**.
- Kontrak call site dipertahankan: `grantRole`/`revokeRole` tetap mengembalikan `{ requiresApproval }`.

**Bug yang ditemukan justru saat probe live, bukan saat gate:** mutasi dari UI **selalu** 403
`INVALID_ORIGIN`. Dua sebab berlapis:

1. `.env` memakai `APP_URL=https://tfn.pimpom.id`, sedangkan server component mengirim origin
   `http://localhost:3000` → tidak cocok. Pembacaan tetap 200 karena GET tidak melewati origin check,
   jadi halaman tampak sehat sementara tombol simpan mati.
2. Setelah escape hatch loopback ditambahkan, mutasi masih 403: `originAllowed` membaca
   `process.env.NODE_ENV` mentah, sedangkan `pnpm start` tidak mengekspornya → `undefined` walau
   skema env memberi default `development`.

Diperbaiki dengan helper `nodeEnv()` (default sama dengan `config/env.ts`) + `isLocalDevOrigin()`,
dan dikunci test tiga lingkungan: `development` lolos loopback tapi menolak `evil.example.com` dan
`evil.example.com.tfn.pimpom.id`; `production` menolak loopback; `test/CI` nol pelonggaran.

Gate: `turbo:verify` 19/19 (unit), `verify:integration` 33/33, `apps/api` 52 test.
Probe live: login 8 akun demo `200`, `roles` `200` (8 role), `POST` loopback `201`, origin asing
`403`, viewer `GET /roles` `403 FORBIDDEN`, `DELETE` role uji `200` (data dikembalikan ke 8 role).

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
