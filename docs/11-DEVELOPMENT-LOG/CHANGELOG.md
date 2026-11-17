## 2026-11-17 — Akun demo lokal + tiga bug yang menghalangi login

Audit "apakah ada akun demo untuk akses lokal" menemukan 8 akun `@boxing.local` sudah ada di seed,
tetapi **tidak satu pun bisa dipakai login**. Tiga bug terpisah:

**1. Password demo tidak cocok (HTTP 401).** `prisma db seed` dan `scripts/bootstrap-admin.ts`
memakai `update: {}`, jadi akun yang sudah ada mempertahankan hash lamanya. Hash di DB tidak cocok
dengan `DEMO_USER_PASSWORD` maupun `BOOTSTRAP_ADMIN_PASSWORD` (diverifikasi dengan
`verifyPassword()` milik `@tfn/auth`, bukan tebakan). Diperbaiki dengan jalur resmi
`pnpm user:reset-password -- --all-demo` → 8/8 akun ter-reset dan terbuka. **Tidak ada perubahan
kode** untuk ini; penyebabnya operasional, bukan bug kode.

**2. Login dari `localhost:3000` ditolak 403.** `hasValidAuthOrigin()` di
`apps/web/src/app/api/auth/origin.ts` melakukan exact-match terhadap `APP_URL`, yang di dev berisi
`https://tfn.pimpom.id`. Akibatnya membuka aplikasi di localhost tidak bisa login sama sekali.
Ditambahkan cabang `isLocalDevOrigin()` yang **hanya aktif saat `NODE_ENV=development`** dan hanya
untuk hostname loopback (`localhost`, `127.0.0.1`, `::1`). Diuji 7 kasus: `https://evil.com` dan
`https://evil.com.tfn.pimpom.id` tetap ditolak di semua mode — CSRF produksi tidak dilonggarkan.

**3. Sesi mati dalam 43 detik, bukan 12 jam.** `apps/api/src/lib/cookie-jar.ts` meneruskan
`maxAge` apa adanya ke Express `res.cookie()`, yang memakai **milidetik**, sementara kontrak
`SessionCookieOptions` memakai **detik**. 43200 detik dibaca sebagai 43200 ms → `Max-Age=43`.
Baris `Session` di DB tetap benar (`expiresAt - createdAt = 43200`), jadi bug murni di adapter
HTTP. Diperbaiki dengan `maxAge * 1000`; satuan didokumentasikan di `SessionCookieOptions` agar
adapter berikutnya tidak mengulanginya. Regresi dikunci di `apps/api/tests/cookie-jar.test.ts`
(3 test: 43200 → `Max-Age=43200`, nilai kecil proporsional, dan cookie sesi tanpa `Max-Age`).

**Verifikasi:** `Set-Cookie: bx_session=...; Max-Age=43200` dari API langsung; login via BFF
`localhost:3000` → 200 dan `/admin` 200 berisi "Super Admin" (tanpa sesi: 307 ke `/admin/login`).
`turbo:verify` 19/19; suite `apps/api` 6 file / 34 test.

**Catatan deploy:** perbaikan 2 dan 3 menyentuh `apps/api` dan `apps/web`, jadi baru berlaku
setelah deploy. Bug 43 detik hampir pasti juga terjadi di produksi — user akan ter-logout dalam
satu menit.

## 2026-11-17 — Audit deploy: `ENCRYPTION_KEY` + API yang tak pernah di-restart

**Temuan:** `scripts/deploy.sh` hanya me-restart proses web (`boxing-tfn`). Sejak Langkah E2 auth
hidup di `apps/api`, dan `apps/web` memanggilnya lewat BFF (`API_INTERNAL_URL`, default
`127.0.0.1:4000`). Artinya deploy bisa "sukses" sementara API tetap menjalankan kode lama — gejala
persis seperti proses `tsx` yatim yang ditemukan di lokal (port 4000 dipegang build pra-E2).

**Diperbaiki**

- `scripts/deploy.sh`: langkah **8b** me-restart `tfn-api` bila terdaftar di PM2, lalu memeriksa
  `/health`. Deploy **gagal (exit 1)** bila health bukan 200 — API mati berarti auth mati.
  Bila proses belum terdaftar, hanya peringatan (deploy web-only tetap sah).
- `apps/api/.env.example`: blok auth (`AUTH_SECRET`, `ENCRYPTION_KEY`, sesi, lockout) + `API_INTERNAL_URL`.
  Sebelumnya file ini tidak menyebut satu pun variabel auth, sehingga siapa pun yang menyalinnya
  mendapat API yang menolak start.
- `.env.example` root: `API_INTERNAL_URL` didokumentasikan (sebelumnya hanya default di kode).
- `docs/10-DEPLOYMENT/DEPLOYMENT-GUIDE.md`: tabel "website/admin/pos/api per-Dockerfile" **dihapus** —
  tidak ada satu pun Dockerfile di repo. Diganti tabel proses PM2 yang nyata. Checklist produksi
  menambah verifikasi `tfn-api` + kesamaan `ENCRYPTION_KEY`.
- `docs/DEPLOYMENT.md`: urutan `deploy.sh` diperbarui.

**Diverifikasi (bukan diasumsikan)**

| Uji | Hasil |
|---|---|
| `ENCRYPTION_KEY=""` boot API | exit 1, `must be a base64-encoded 32-byte key` |
| `ENCRYPTION_KEY="dGVzdA=="` (4 byte) | exit 1, pesan sama |
| `ENCRYPTION_KEY` valid dari `.env` | server listening (kontrol positif) |
| Web vs API pakai kunci sama | keduanya baca root `.env`, tidak ada override di app |
| Blok 8b, API terdaftar + health 200 | exit 0, `✓ API health OK` |
| Blok 8b, API terdaftar + health 503 | **exit 1**, pesan menyebut `ENCRYPTION_KEY` |
| Blok 8b, API tidak terdaftar | exit 0 + peringatan cara mendaftarkan |
| `bash -n scripts/deploy.sh` | sintaks valid |

## 2026-11-17 — Langkah F: `rbac` ke `packages/auth`, `apps/web/src/server/services` habis

**Cakupan:** berkas terakhir yang menyimpan logika domain di `apps/web/src/server/services/` pindah
ke paket. Setelah ini isi folder tersebut **hanya binding** — tidak ada lagi aturan bisnis di dalam app.

| Pindah ke `packages/auth` | Dari |
|---|---|
| `rbac.service.ts` — `createRbacService({ db, audit })` | `apps/web/src/server/services/rbac.service.ts` (578 baris) |

Inventaris folder sebelum pemindahan (7 berkas): `rbac.service.ts` **578 baris** = satu-satunya logika
nyata. Enam sisanya (`audit`, `auth`, `settings`, `sponsor`, `ticketing`, `ticket-pdf`) masing-masing
di bawah 60 baris dan memang milik lapisan web — `next/headers` atau Prisma web — jadi **tidak**
dipindah dan tidak dihapus.

Dependensi yang disuntik: `db` (Prisma proses pemanggil) dan `audit` (binding web menambahkan
IP/User-Agent dari `headers()`, API memakai versi `req`). Semua 21 ekspor lama dipertahankan lewat
binding tipis, jadi `actions.ts`, `page.tsx`, `RoleManager.tsx`, dan `UserManager.tsx` **tidak
berubah satu baris pun**.

Kontrak perilaku yang sengaja dipertahankan persis: urutan validasi, four-eyes untuk role sensitif
(`RoleRequest` PENDING + reviewer ≠ requester), proteksi super-admin terakhir, pencabutan semua sesi
saat akun dinonaktifkan, dan penulisan audit di setiap jalur.

### Penjaga arsitektur baru

`apps/api/tests/package-boundary.test.ts` membaca sumber `packages/auth/src` dan gagal bila ada
berkas yang mengimpor `next/*`, `server-only`, alias `@/…`, atau membuat `new PrismaClient()`
sendiri. Diuji dengan menyuntikkan pelanggaran sementara — test memang **merah**, bukan hijau palsu.

### Terbukti hidup

| Uji | Hasil |
|---|---|
| `createRbacService` dijalankan via `tsx` **di luar Next** (paket `@tfn/auth`) | 8 role, 8 user, 0 pending, 71 permission |
| Jalur error domain tanpa Next | `RbacError - Role not found`, `ZodError` |
| `GET /admin/roles`, `/admin/users`, `/admin/audit-logs` | 200 / 200 / 200 |
| `pnpm turbo:verify` | **19/19** |
| `apps/api` test | **39/39** (7 berkas; +3 cookie, +5 boundary) |
| `apps/web` unit test | **89/89** |
| `verify:integration` | **33/33** |
| `next build` | **tidak dijalankan** (aturan repo) |

## 2026-11-17 — Langkah E2: `auth` ke `packages/auth`, alias `@/*` di `apps/api` dihapus

**Cakupan:** sisa terakhir ketergantungan terbalik API → `apps/web/src` hilang.

| Pindah ke `packages/auth` | Dari |
|---|---|
| `session.service.ts` — `createAuthService(deps)` | `apps/web/src/server/services/auth.service.ts` (280 baris) |
| `crypto.ts` — `sha256Hex`, `randomToken`, `safeEqual`, `hmacSha256`, `encryptSecret`, `decryptSecret` | `apps/web/src/lib/security/crypto.ts` |
| `totp.ts` — RFC 6238 | `apps/web/src/lib/security/totp.ts` |

Web dan API kini **binding tipis** di atas paket yang sama; bedanya hanya sumber cookie
(`next/headers` vs Express) dan Prisma client milik masing-masing proses.

`apps/api`: alias `@/*` → `../web/src/*` **dihapus**, bersama `tsconfig.dev.json` dan folder
`src/shims/` (`server-only`, `next/headers`) yang jadi mati. Script `dev`/`start` tidak lagi butuh
`--tsconfig` khusus.

### Dua bug yang ditemukan gate (bukan test yang salah)

1. **Snapshot `env`.** Paket awalnya menerima `env: AuthEnv` sehingga konfigurasi dibaca sekali saat
   modul dimuat. Kode lama memanggil `env()` per request — bedanya berarti perubahan
   `AUTH_ENFORCE_MFA`/`APP_URL` butuh restart diam-diam. Kontrak diubah jadi `env: () => AuthEnv`.
2. **`stubEnv` diabaikan.** Binding membaca `env().APP_URL` dari mock yang tidak punya field itu;
   sekarang `process.env.APP_URL ?? e.APP_URL`, sesuai semantik asli.

`apps/api/src/config/env.ts` kini **mewajibkan `ENCRYPTION_KEY`** (base64 32 byte) — tanpa itu akun
ber-MFA gagal login lewat API karena `mfaSecretEnc` tidak bisa didekripsi.

### Terbukti hidup

| Uji | Hasil |
|---|---|
| `GET /health`, `/health/ready` | 200 / 200 (DB up) |
| `POST /api/auth/login` kredensial salah | 401 `INVALID_CREDENTIALS` (jalur paket + `loginAttempt`) |
| `GET /api/auth/me` tanpa cookie | 401 `UNAUTHORIZED` envelope ADR-010 |
| `POST /api/auth/logout` tanpa sesi | 200 idempotent |
| `pnpm turbo:verify` | **19/19** |
| `apps/web` unit test | **89/89** |
| `apps/api` test | **31/31** |
| `verify:integration` | **33/33** |
| `test:gate-a2` | **3/3** |
| `next build` | lolos |

## 2026-11-17 — Langkah D: `audit`/`settings`/`sponsor` ke `packages/core` + worker

**Cakupan:** paket domain baru `@tfn/core` dan otoritas settings pindah dari Next ke `apps/api`.

| Endpoint baru di `apps/api` | Penjaga |
|---|---|
| `GET /api/settings` | sesi + `settings.manage` |
| `PUT /api/settings` | sesi + `settings.manage` + origin |
| `GET /api/sponsors` | publik |

`packages/core` berisi `audit`, `settings`, `sponsor`, plus util murni `redact`, `setting-schemas`,
`sponsor-tiers`. Dependensi (`prisma`, konteks request, `logAudit`) **diinjeksi** per-app, sama
seperti `packages/ticketing` — paket tidak membaca env sendiri dan tidak membuat pool sendiri.

Web: tiga service jadi binding tipis; call site lama tidak berubah. Server action admin settings
kini **proxy** ke API, jadi Prisma tidak lagi ditulis dari proses Next untuk settings.

### Terbukti hidup

| Uji | Hasil |
|---|---|
| `GET /api/sponsors` | 200 `{"data":[]}` |
| `GET /api/settings` | 200, nilai default dari DB |
| `PUT` tanpa sesi | 401 `UNAUTHORIZED` |
| `PUT` origin asing | 403 `INVALID_ORIGIN` |
| `PUT` sesi sah | 200, `applied:["footer.general"]` |
| `PUT` key tak dikenal | 400 `Unknown setting key: bogus.key` |
| `AuditLog` | `SETTINGS_UPDATE`, actorId benar, `ipAddress=127.0.0.1` |

Worker `expire-holds` dibuktikan menyapu hold nyata: `scanned=1 expired=1 seatsReleased=2`, order
`PENDING_CONFIRMATION` → `CANCELLED`, `sold` 5 → 3 (hold di-backdate 30 jam).

### Dua bug yang ditemukan gate, bukan direncanakan

1. **Bundel `apps/api` sudah rusak sejak Langkah C.** Script build memakai `--packages=external`
   tanpa alias `@tfn/ticketing`, sehingga `dist/index.js` mengimpor file `.ts` mentah dan gagal saat
   dijalankan. Tak pernah ketahuan karena pengujian memakai `tsx`, bukan `dist`. Alias
   `@tfn/ticketing*` dan `@tfn/core*` ditambahkan; `verify:dist` (smoke `/health`, `/health/ready`)
   kini lulus.
2. **`packages/core` belum punya `eslint.config.mjs`**, sehingga `turbo:verify` gagal di task lint.
   Config dibuat mengikuti `apps/api`, tanpa aturan `no-console` karena ini library.

### Gate

`pnpm turbo:verify` → **16/16 task** (naik dari 12 karena `@tfn/core` masuk pipeline), unit **89**
lulus · `pnpm verify:integration` → **33/33** · `pnpm test:gate-a2` → **3/3** dengan
`[negctl] kuota=3 sukses=3 ditolak=17 sold=3`.

### Belum selesai (jujur)

- Notifikasi & sheets sync (TFN-018) **tidak dikerjakan** — belum ada kodenya sama sekali.
- `saveTicketTypeAction` masih menulis `prisma` langsung dari web.
- Worker masih membawa `--conditions=react-server` yang tak lagi dibutuhkan binding barunya.

---

## 2026-11-17 — Langkah C: ticketing dipindah ke `apps/api`

**Cakupan:** router ticketing di `apps/api` + web menjadi proxy tipis.

| Endpoint baru di `apps/api` | Penjaga |
|---|---|
| `GET /api/ticketing/events` | publik |
| `GET /api/ticketing/orders/:no?token=` | capability token |
| `POST /api/ticketing/orders` | origin + rate limit |
| `GET /api/ticketing/orders/:no/ticket?token=` | capability token, PDF biner |
| `POST /api/ticketing/orders/:id/confirm` | sesi + `ticketing.confirm` |
| `POST /api/ticketing/orders/:id/reject` | sesi + `ticketing.confirm` |
| `POST /api/ticketing/check-in` | sesi + `ticketing.confirm` |

Web (`/api/ticketing/*`, `/tickets/[no]/ticket`, server action admin & scan) kini hanya meneruskan
cookie sesi + origin ke API. Logika bisnis tetap satu sumber: `ticketing.service.ts`.

### Terbukti hidup (bukan hanya kompilasi)

Order nyata dibuat lewat API, lalu jalur lengkap diuji: `201` create → `200` confirm → **PDF 11 KB
`%PDF-1.7`** → `200` check-in → `400 ALREADY_USED` saat discan ulang. Proxy web juga mengembalikan
PDF valid (11 KB, `application/pdf`).

### Tiga bug yang ditemukan saat pemindahan

1. **`pdf-lib` & `qrcode` tidak ada di `apps/api`.** Bundle hanya naik 30 kb (normalnya ~1 MB) karena
   esbuild menandai `--packages=external`. Endpoint PDF akan **crash 500 di production** meski
   typecheck hijau. Sudah ditambahkan sebagai dependency `apps/api`.
2. **`apiFetch` tidak meneruskan cookie browser.** Route admin (confirm/reject/check-in) akan selalu
   401 dari API. Diperbaiki dengan forward `cookie` + `origin`, mengikuti pola `auth/logout`.
3. **Tipe `CheckInResult` bocor menjadi `unknown`** akibat trik tipe kondisional di `scan/actions.ts`;
   diganti tipe eksplisit `CheckInOutcome`.

### Dua flaky test yang diperbaiki (bukan diabaikan)

- **`buyer-cap` gagal ~1 dari 3 run.** Penyebab: tiga file integrasi memanggil `expireStaleHolds()`
  yang **global** (`take: 200` lintas event) sementara vitest menjalankan file **paralel** pada satu
  DB. Sapuan file A men-CANCEL order "basi" milik file B sebelum gilirannya. Perbaikan:
  `fileParallelism: false` untuk project integration (biaya ~3 detik, gate jadi deterministik).
- **`ticket-artifact` gagal ~1 dari 5 run.** Penyebab: `pdf-lib` menulis `CreationDate`/`ModDate`
  sehingga **panjang byte** berbeda 1 antar detik, walau isi identik. Tes membandingkan `byteLength`.
  Perbaikan: bandingkan `payload` + `filename`, bukan ukuran berkas.

Setelah perbaikan: **8/8 run integrasi hijau berturut-turut**.

### Gate

- Integrasi **33/33** (termasuk Gate A2: 50/50, 50/10, kontrol negatif 3/17)
- `turbo:verify` **12/12**
- Data uji dibersihkan; port 3000/4000 bersih.

### Sisa (dicatat, belum dikerjakan)

- `ticketing.service.ts` + `ticket-pdf.service.ts` **masih di `apps/web/src/server/services/`** dan
  diimpor `apps/api` lewat alias. Belum dipindah ke `packages/` — "satu sumber" saat ini berarti
  satu *file*, bukan satu *paket*.
- `saveTicketTypeAction` (CRUD kategori tiket) masih memakai `prisma` langsung.

# Changelog

Format: tanggal · ringkas · bukti. Hanya perubahan yang benar-benar terjadi.

## 2026-11-17 — Gate A2 dijalankan (baseline ticketing sebelum Langkah C)

**Latar:** dokumen (`ARCHITECTURE.md`, `TASK-TRACKER.md`, `PROJECT-STATUS.md`) mengklaim
"50 request paralel → tepat 50 kursi, 0 oversell", tetapi tes yang benar-benar ada hanya
menguji **2 order** bersamaan. Klaim itu belum pernah diverifikasi pada skalanya.

**Yang ditambahkan:**
- `apps/web/tests/integration/ticketing-concurrency.integration.test.ts` — 2 tes.
- `apps/web/tests/integration/ticketing-negative-control.integration.test.ts` — 1 tes kontrol.
- Script root `test:gate-a2` (jalankan hanya Gate A2) dan `verify:integration`.

**Detail desain yang menentukan:**
- Cap per pembeli = **10 tiket/kategori**, jadi 50 order paralel memakai **50 pembeli berbeda**
  (email + telepon unik). Dengan satu email, tes akan gagal karena cap — bukan karena kapasitas —
  sehingga hasilnya menyesatkan ke arah sebaliknya.
- Kuota kategori dibuat **tepat 50** agar batas benar-benar diperebutkan (bukan 100 yang longgar).
- Penolakan diperiksa harus berupa `TicketingError` (kesalahan domain), bukan crash/timeout/pool habis.

**Hasil (MySQL `boxing_test` di :3307, data nyata):**
| Skenario | Hasil |
|---|---|
| 50 order paralel / kuota 50 | **50 sukses, 0 ditolak, `sold` = 50** |
| 60 order paralel / kuota 50 | **50 sukses, 10 ditolak, `sold` = 50** (tidak pernah 51) |
| Kontrol negatif: kuota 3 / 20 paralel | **3 sukses, 17 ditolak, `sold` = 3** |

Kontrol negatif sengaja dibuat agar tes konkurensi tidak "hijau karena kebetulan" —
angka 3/17 membuktikan guard kapasitas benar-benar aktif dan menolak.

**Celah gate yang ditemukan:** `turbo:verify` hanya menjalankan `test` = **unit** (89 tes).
**33 tes integrasi tidak pernah ikut gate.** Karena itu integrasi butuh DB hidup, ia tidak
dimasukkan ke `turbo:verify` (yang harus tetap bisa jalan tanpa Docker), melainkan ke
`verify:integration` / `test:gate-a2` yang eksplisit.

**Suite:** integrasi **33/33** lulus (7 file; naik dari 30 karena 3 tes baru).
DB test bersih setelah run: `Event=0 TicketType=0 TicketOrder=0` berprefiks `itest-`.
`turbo:verify` tetap **12/12**.

**Arti untuk Langkah C:** baseline sah sekarang ada. Setelah ticketing dipindah ke `apps/api`,
`pnpm test:gate-a2` harus menghasilkan angka yang sama persis (50/50, 50/10, 3/17).

## 2026-11-17 — Langkah B (slice 3/3): Langkah B SELESAI — otoritas auth pindah ke `apps/api`

**Bentuk akhir:** route `/api/auth/*` di `apps/web` kini **proxy tipis** (ADR-013). URL publik tidak
berubah, jadi tidak ada komponen UI yang perlu disentuh, tetapi **tidak ada lagi auth yang
dieksekusi di Next** — satu sumber kebenaran sesi ada di `apps/api`.

**File:**
- `apps/web/src/app/api/auth/login/route.ts` — validasi Zod + rate limit + origin, lalu proxy.
- `apps/web/src/app/api/auth/logout/route.ts` — meneruskan cookie browser, meneruskan cookie hapus.
- `apps/web/src/app/api/auth/me/route.ts` — membaca sesi dari API, 401 diteruskan apa adanya.
- `apps/web/src/lib/api/client.ts` — `apiFetchRaw()` baru mengembalikan `setCookies`;
  `apiFetch()` jadi pembungkus tipis (satu `fetch` call, bukan dua salinan).
- `apps/web/tests/unit/auth-routes-security.test.ts` — ditulis ulang untuk menguji **kontrak proxy**.

**Keputusan penting — cookie tidak dirakit di Next.** Versi pertama route login saya sempat memakai
fungsi placeholder yang membuang `set-cookie`; itu berarti UI "login sukses" tanpa sesi. Diperbaiki
dengan meneruskan header dari `apps/api` apa adanya, sehingga hanya API yang menerbitkan cookie.

**Regresi keamanan yang tertangkap gate (dan diperbaiki):** saat menulis ulang route login,
batas body 16 KB hilang (sempat jadi 400, bukan 413). Dipulihkan dengan membaca stream dan
`reader.cancel()` — `Content-Length` tidak dipercaya.

**Bukti hidup (web :3123 → apps/api :4000 → MySQL):**
| Skenario | Hasil |
|---|---|
| Login via BFF | **200**, `Set-Cookie` **HttpOnly** |
| `/me` via BFF | **200**, roles `["super_admin"]`, **24 permission** |
| logout via BFF | **200**, cookie kedaluwarsa 1970 dikirim |
| `/me` setelah logout | **401** |
| `/admin`, `/admin/users` dengan sesi API | **200** render |
| `/admin`, `/admin/users` tanpa sesi | **307** → `/admin/login` |
| origin asing / `null` / tanpa origin | **403** |
| same-origin + `sec-fetch-site: cross-site` | **403** |
| Halaman login UI (password salah) | pesan `Invalid email or password` dari API |

**Gate:** `pnpm turbo:verify` → **12/12**. Web **119** test (89 unit + 30 integration; dari 116),
API **31**, worker **5**. `apps/api` runtime bersih setelah shim (ADR-015).

**Status Langkah B: SELESAI (3/3).**

## 2026-11-17 — Langkah B (slice 2/3): auth berjalan di `apps/api`

**Hasil:** login/logout/me tersedia di `apps/api` memakai **service yang sama** dengan web —
tidak ada duplikasi logika. Bedanya hanya sumber cookie: `createExpressCookieJar(req, res)`.

**File baru:**
- `apps/api/src/lib/cookie-jar.ts` — `parseCookieHeader()` + `createExpressCookieJar()`
  (implementasi `SessionCookieJar` di atas `req`/`res`, tanpa dependensi baru).
- `apps/api/src/routes/auth.ts` — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
  semua dengan envelope ADR-010.
- `apps/api/src/shims/{server-only,next-headers}.ts` — shim untuk runtime non-Next.
- `apps/api/tests/auth-routes.test.ts` — 12 test.

**Tiga bug nyata yang ditemukan saat bukti hidup (bukan saat menulis kode):**
1. `ERR_MODULE_NOT_FOUND: server-only` — paket hanya dideklarasikan di `apps/web`; ditambahkan ke
   dependencies `apps/api`.
2. `ERR_MODULE_NOT_FOUND: next` — adapter default `auth.service` menarik `next/headers` ke bundle API.
   Diselesaikan dengan shim + `--alias` esbuild; shim `cookies()` **melempar** bila dipanggil,
   jadi pemanggil yang lupa menyuntik jar gagal berisik, bukan diam-diam.
3. `Cannot find package '@/server/services/auth.service'` di vitest (health/docs test jadi FAIL) —
   alias `@/*` tidak diketahui vitest. Ditambahkan `resolve.alias` di `vitest.config.mts`,
   sejalan dengan `tsconfig.json` dan flag esbuild.

**Bukti hidup (DB nyata, MySQL 127.0.0.1:3307):**
- Login salah → `401 INVALID_CREDENTIALS` (bukan 500).
- `/me` tanpa cookie → `401 UNAUTHORIZED`.
- Login benar (`superadmin@boxing.local`) → **200**, `Set-Cookie` **HttpOnly**, roles `["super_admin"]`.
- `/me` dengan cookie → **200**, **24 permission** terkirim.
- `logout` → **200**, cookie dihapus (`cleared: true`).
- `/me` **setelah** logout → **401** ⇒ sesi benar-benar dicabut, bukan hanya cookie dibuang.
- Password demo hanya dibaca dari `.env` di dalam skrip probe dan **tidak pernah dicetak**.

**Gate:** `pnpm turbo:verify` → **12/12 task**. Test API **31/31** (naik dari 19).

**Sisa Langkah B:** slice 3/3 — BFF Next memanggil `/api/auth/*`, halaman admin tetap bisa login,
deny-path diuji, lalu route lama di `apps/web/src/app/api/auth/*` dihapus.

## 2026-11-17 — Langkah B (slice 1/3): `auth.service` lepas dari `next/headers`

**Kenapa ini dulu:** Langkah B memindahkan auth ke `apps/api`, tetapi `auth.service.ts` memanggil
`cookies()` dari `next/headers` di 3 fungsi (`getSession`, `setSessionCookie`, `destroySession`).
Selama itu ada, service mustahil dipanggil Express — memindahkan filenya saja akan langsung gagal.

**Yang dikerjakan (tanpa perubahan perilaku):**
- `src/lib/auth/session-cookie-jar.ts` — interface `SessionCookieJar` (`get`/`set`/`delete`) +
  `createMemoryCookieJar()` untuk test. **Tidak** mengimpor `next/*`.
- `src/server/services/next-session-cookie-jar.ts` — satu-satunya tempat yang menyentuh
  `next/headers`; membungkusnya jadi `SessionCookieJar`.
- `auth.service.ts` — tiga fungsi menerima `jar?: SessionCookieJar`. Tanpa `jar` → jar Next
  (perilaku identik); dengan `jar` → tidak menyentuh `next/headers` sama sekali.
  Sisa pemanggilan `cookies()` langsung di file itu: **0**.

**Bukti:**
- `tests/unit/auth-cookie-jar.test.ts` (4 test) memakai `vi.mock("next/headers")` yang **melempar
  bila `cookies()` dipanggil**, lalu menyuntik jar sendiri — keempatnya lulus, artinya service
  benar-benar tidak lagi bergantung pada Next.
- Dicatat juga bahwa token di-hash: argumen `findUnique` memakai `tokenHash` 64 hex, bukan token mentah.
- Regresi: `pnpm test:all` di `apps/web` → **116 test / 22 file lulus** (naik dari 105), `next build` OK,
  `pnpm turbo:verify` → **12/12 task**.

**Sisa Langkah B:** (2) jar Express di atas `req`/`res` + route `/api/auth/*` di `apps/api`;
(3) BFF Next memanggil API, halaman admin tetap bisa login, deny-path diuji.

## 2026-11-17 — NT-6: Next.js jadi BFF/proxy · NT-7: `apps/worker` terpisah

**NT-6 — Next = BFF ke `apps/api` (ADR-013):**
- `apps/web/src/lib/api/client.ts`: `apiFetch()` + `ApiClientError`. Meneruskan `x-request-id`,
  `cache: "no-store"`, timeout 8 s, dan menerjemahkan envelope ADR-010 jadi error bertipe.
  Kegagalan jaringan/timeout → `503 UPSTREAM_UNREACHABLE` / `UPSTREAM_TIMEOUT`.
- Env baru `API_INTERNAL_URL` (default `http://127.0.0.1:4000`) di `apps/web/src/lib/env.ts`.
- Rute contoh hidup `GET /api/v1/meta`. Bukti nyata: **200** dengan body `{"service":"tfn-api",…}`
  saat `apps/api` menyala; **503** `{"error":{"code":"UPSTREAM_UNREACHABLE",…}}` saat api dimatikan.
  `x-request-id: req-manual-1` dari klien terlihat di respons → header benar-benar diteruskan.
- 7 unit test (`apps/web/tests/unit/api-bff-client.test.ts`) — termasuk base URL berakhiran slash,
  envelope tanpa `error`, upstream mati, timeout, dan propagasi `requestId`.

**NT-7 — `apps/worker` (`@tfn/worker`, ADR-014):**
- `src/cli.ts` (dispatch command + `--verbose`), `src/jobs/expire-holds.ts`, `src/lib/report.ts`.
- **Tanpa duplikasi logika:** job memanggil `expireStaleHolds` milik `apps/web` lewat pemetaan
  `@/*` → `apps/web/src/*` di tsconfig worker, dijalankan dengan `--conditions=react-server`.
- 5 unit test untuk format keluaran & exit code.
- Bukti nyata: `expire-holds --verbose` → `[expire-holds] scanned=0 expired=0 skipped=0
  seatsReleased=0 (121ms)` — job benar-benar menyentuh database, bukan sekadar exit 0.
- `scripts/expire-holds.ts` **dihapus**; `pnpm ticketing:expire-holds` dan
  `scripts/cron/expire-holds.sh` kini memanggil `pnpm worker:expire-holds` (satu implementasi).

**Gate:** `pnpm turbo:verify` → **12/12 task** (sebelumnya 9; worker menambah typecheck+lint+test).

## 2026-11-17 — Langkah A: aplikasi Next.js pindah ke `apps/web` + Prisma Client jadi `@tfn/db`

**Blocker yang diselesaikan lebih dulu (Opsi A):** Prisma Client digenerate ke `src/generated/prisma`
(di dalam `src/`), dipakai web **dan** `apps/api`. Memindahkan `src/` akan memutus salah satu sisi.

**Yang dikerjakan:**
- `packages/db` (`@tfn/db`): satu-satunya pintu ke Prisma Client. Output generator dipindah ke
  `packages/db/src/generated/prisma` (`prisma/schema.prisma`), tetap gitignored. Subpath export
  `@tfn/db/client` dan `@tfn/db/enums` supaya impor tetap granular.
- 7 impor diarahkan ulang: `src/lib/db/prisma.ts`, `ticketing.service.ts`, `settings.service.ts`,
  `apps/api/src/db/prisma.ts`, `scripts/bootstrap-admin.ts`, `scripts/reset-password.ts`, `prisma/seed.ts`.
- `apps/web` dibuat: `src/app`, `src/components`, `src/lib`, `src/server`, `src/proxy.ts`, `src/styles`,
  `public`, `tests`, `storage`, plus `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
  `vitest.config.ts`, `postcss.config.mjs`, `scripts/verify/`. `apps/web/package.json` = `@tfn/web`.
- Root jadi orchestrator: script `dev/build/start/test:*` meneruskan ke `@tfn/web`, `typecheck` root
  hanya untuk `scripts/` + `prisma/`. `package-lock.json` dihapus (pnpm satu-satunya package manager).

**Tiga bug nyata yang muncul saat pemindahan (bukan teoretis):**
1. `--packages=external` membuat esbuild meng-external-kan `@tfn/db` (source TS) → `ERR_MODULE_NOT_FOUND`
   saat `node dist/index.js`. Diperbaiki dengan `--alias` untuk `@tfn/db`, `@tfn/db/client`, `@tfn/db/enums`.
2. Next hanya membaca `.env` di direktori app → semua koneksi DB jatuh ke default. Diperbaiki: `next.config.ts`
   memuat `../../.env` via dotenv, `tests/setup.ts` menunjuk path `.env` root secara eksplisit.
3. `turbopack.root` diarahkan ke `apps/web` → Turbopack menganggap `next` tidak terpasang (node_modules
   ada di root, `node-linker=hoisted`). Diperbaiki: `turbopack.root` + `outputFileTracingRoot` = root repo.

**Bukti:**
- `pnpm turbo:verify` → **9/9 task sukses** (root typecheck; web typecheck+lint+test; api typecheck+lint+test+verify:dist; db typecheck).
- `apps/web` test: **105 lulus** (75 unit + 30 integration).
- `next build` dari `apps/web` sukses; 26 `page.tsx` terdeteksi.
- `next start -p 3123` probe: `/`, `/events`, `/fighters`, `/fights`, `/rankings`, `/news`, `/belts`,
  `/grand-prix`, `/tickets`, `/tickets/status`, `/robots.txt`, `/sitemap.xml` → **200**;
  `/admin/users` → **307** (redirect auth, sesuai); `/admin/login` → **200**; `/api/auth/login` GET → **405**.

## 2026-11-17 — `apps/api`: artefak produksi + smoke test `dist`

**Masalah:** `build` (`tsc -p tsconfig.build.json`) **gagal** — `TS6059`: Prisma Client 7 yang
digenerate sebagai **TypeScript** di root (`src/generated/prisma`) berada di luar `rootDir`
`apps/api`. Artinya selama ini "build lulus" hanya berarti `tsc --noEmit` (typecheck), **bukan**
artefak yang bisa dijalankan.

**Perbaikan:**
- `build` diganti ke **esbuild** bundle: `dist/index.js` (345 kb + sourcemap). `--packages=external`
  agar dependency Node tidak di-bundle; Prisma Client (import relatif) ikut masuk bundle.
- `tsconfig.build.json` dihapus (tidak dipakai, menyesatkan).
- Script baru: `start:prod` (`node dist/index.js`), `verify:dist` (`pnpm build && node
  scripts/smoke-dist.mjs`).

**Bug produksi ke-4 yang ketemu lewat smoke test ini:** menjalankan `node dist/index.js` membuat
`/health/ready` → **503** walau DB sehat. Penyebab: `env.ts` menghitung path `.env` dari
`import.meta.url`; setelah di-bundle lokasinya pindah `src/config/` → `dist/`, sehingga `.env`
root tidak ditemukan dan service **diam-diam** memakai default (`MYSQL_USER=boxing`, password
kosong) → `Access denied ... (using password: NO)`. Bukan masalah kredensial, murni resolusi path.
Perbaikan: kandidat `.env` diturunkan dari `process.cwd()` + induknya (apps/api → apps → root),
fallback berbasis lokasi file, plus dukungan `ENV_FILE`; file yang benar-benar dibaca kini
**dicatat di log startup** bersama target DB (tanpa password).

**Bukti (semua dijalankan):**

| Cek | Hasil |
|---|---|
| `pnpm --filter @tfn/api build` | `dist/index.js` 345.8 kb + map, 14 ms |
| `node dist/index.js` dari **`cwd=/tmp`** | start OK; log `config resolved` menyebut `.env` root |
| `/health` · `/health/ready` · `/api/v1/meta` · 404 | **200 · 200 `{"database":"up"}` · 200 · 404** envelope standar |
| `pnpm turbo:verify` | **7/7 task** (typecheck, lint, test, verify:dist), 8.8 s |
| Smoke `dist` (port 4123, `cwd=tmpdir()`) | ✓ lulus — kini masuk gate |

**Catatan gate:** `verify:dist` **tidak** memakai `turbo` `dependsOn: ["build"]` karena itu akan
memicu `next build` di root app (berat + butuh DB); script membangun dirinya sendiri lebih dulu.

## 2026-11-17 — Phase 1: fondasi monorepo + `apps/api` skeleton

Ruang lingkup disetujui Irhan. **Tidak ada file aplikasi existing yang dipindah atau dihapus.**

**Struktur baru**
- `pnpm-workspace.yaml` — workspace `"."` + `"apps/*"` (root ikut agar Turborepo menjalankan
  typecheck/lint/test app lama dalam satu perintah). `packages/*` sengaja belum dibuat: tidak
  ada kode bersama yang nyata (ADR-001).
- `pnpm-workspace.yaml` → `allowBuilds`: pnpm 12 memblokir lifecycle script dependency secara
  default. Dua percobaan gagal dicatat: `package.json#pnpm.onlyBuiltDependencies` **diabaikan**
  ("no longer read by pnpm") dan bentuk *list* pada `allowBuilds` **gagal parse** ("expected
  mapping start"). Bentuk yang benar: mapping `nama-paket: true|false`.
  Diizinkan: `@prisma/engines`, `prisma`, `esbuild`, `sharp`, `@node-rs/argon2`;
  `@scarf/scarf: false` (postinstall-nya hanya telemetri).
- `.npmrc` — `node-linker=hoisted` supaya app Next.js lama tetap berjalan dengan `node_modules`
  gaya lama setelah pindah ke pnpm.
- `turbo.json` — task `build`/`typecheck`/`lint`/`test`/`dev`/`db:generate`; `test.outputs: []`
  (sebelumnya `coverage/**` memicu peringatan "no output files found").
- `package.json` root — `packageManager: pnpm@12.10.1` (**wajib**, tanpa ini Turborepo menolak
  dengan "Could not resolve workspace"), `turbo ^2.11.11`, script `turbo:verify`, `api:dev`,
  `api:test`. Script app lama tidak diubah.

**`apps/api` (Express 5 + TypeScript)**
`src/config/env.ts` (zod, fail fast, baca `apps/api/.env` → `<root>/.env`, parse `DATABASE_URL`),
`src/lib/{logger,errors}.ts`, `src/middleware/{request-context,not-found,error-handler}.ts`,
`src/db/prisma.ts` (Prisma 7 + `@prisma/adapter-mariadb`, client digenerate dari
`prisma/schema.prisma` root — ADR-009, tidak ada schema duplikat), `src/routes/{health,v1}.ts`,
`src/docs/openapi.ts` (OpenAPI 3.1 + Swagger UI), `src/{app,index}.ts` (`createApp()` factory,
graceful shutdown), 4 file test, `eslint.config.mjs`, `tsconfig{,.build}.json`,
`vitest.config.mts`, `.env.example`, `README.md`.

**Dua bug ditemukan & diperbaiki saat verifikasi**
1. Parser `bool` di `env.ts` mengubah nilai kosong menjadi `false`, sehingga `/api/openapi.json`
   dan `/api/docs` **404 di runtime** walau test lulus (test lama hanya menguji jalur
   `openApiEnabled: true` eksplisit). Sekarang `undefined` tetap `undefined`; ditambah test
   regresi "docs aktif secara default".
2. `pnpm add -D typescript` menarik TypeScript **7.0.2**, dan `typescript-eslint` menolak jalan
   ("does not support TS 7.0"). Dipin ke `typescript@5.9.3` (sama dengan root).

**Bukti (dijalankan, bukan perkiraan)**
- `pnpm --filter @tfn/api typecheck` → 0 error · `lint` → 0 error/0 warning ·
  `test` → **19 lulus / 4 file**.
- `pnpm turbo:verify` → **6 task sukses, 0 cached, 9,62 s** (root typecheck+lint+unit, api
  typecheck+lint+test).
- API live (`:4000`, DB container `:3307`): `/health` 200 ·
  `/health/ready` 200 `{"database":"up"}` · `/api/v1/meta` 200 · `/api/openapi.json` 200
  (OpenAPI 3.1.0) · `/api/docs/` 200 · route tak dikenal → 404 dengan
  `{error:{code,message,requestId}}` · header `x-request-id` selalu ada.
- Regresi app lama pasca `pnpm install`: `typecheck` 0 · `lint` 0 · `next build` sukses ·
  unit **75 lulus (15 file)** · integration **30 lulus (5 file)**.

**Dokumentasi**
- `docs/02-ARCHITECTURE/MIGRATION-PLAN-WEB.md` (baru, **DRAFT — belum disetujui**): 5 langkah
  (A `apps/web` → B auth → C ticketing → D worker → E bersih-bersih) + risiko, rollback,
  acceptance criteria, dan 4 pertanyaan yang menunggu keputusan Irhan.
- `docs/02-ARCHITECTURE/MONOREPO-STRUCTURE.md` — status: sebagian terwujud (lihat §Status).

## 2026-11-17 — Blocker P0: database lokal, lint, sitemap

**Blockers fixed**

1. **DB lokal (port 3307).** Dua penyebab: (a) `.env` memakai `MYSQL_PORT=3306` +
   `DATABASE_URL ...:3306/boxing` padahal Compose memetakan host ke 3307 (3306 dipakai MariaDB
   sistem), jadi container dibuat tapi gagal bind; (b) `docker/mysql/init/01-dev-setup.sql`
   melakukan `GRANT ... TO 'boxing'@'%'` sementara `MYSQL_USER=boxing_user` — MySQL 8 menolak
   GRANT ke user yang tidak ada sehingga inisialisasi volume gagal.
   `TEST_DATABASE_URL` juga menunjuk DB `boxing` (sama dengan dev) — sekarang `boxing_test`.
2. **Lint.** `layout.tsx` memakai `dangerouslySetInnerHTML` (dilarang `no-restricted-syntax`);
   `official-crest.cjs` punya variabel `rgb` tak terpakai.
3. **Sitemap.** `sitemap.ts`/`robots.ts` tidak ada (produksi 404).

**Diubah**
- `.env` — `MYSQL_PORT=3307`, `DATABASE_URL` → `127.0.0.1:3307/boxing`,
  `TEST_DATABASE_URL` → `127.0.0.1:3307/boxing_test` (backup: `backups/config-20261117-105216/`).
- `docker/mysql/init/01-dev-setup.sql` — grant ke `'boxing_user'@'%'` + catatan kenapa.
- `src/app/layout.tsx` — tema dari cookie via `cookies()`, render `<html class>` di server;
  tidak ada `next/script`/inline JS.
- `src/lib/theme/ThemeContext.tsx` — `useSyncExternalStore` (localStorage → cookie → dark),
  `setTheme` menulis localStorage + cookie; reconcile pasca-hydration tanpa `setState` di effect.
- `src/app/sitemap.ts` (baru) — 9 route statis + fighter `ACTIVE`/`deletedAt: null`, try/catch,
  `revalidate = 3600`; mengecualikan `/admin`, `/api`, `/tickets/status`.
- `src/app/robots.ts` (baru) — disallow `/admin`, `/admin/`, `/api/`, `/tickets/status`, + sitemap.
- `src/app/(public)/tickets/status/page.tsx`, `src/app/admin/(dashboard)/layout.tsx` — `robots: noindex`.
- `scripts/verify/official-crest.cjs` — hapus helper `rgb` yang tidak dipakai.
- `public/theme-init.js` — **dihapus** (digantikan render SSR dari cookie).

**Diverifikasi**
- `docker ps` → `boxing-mysql` running/healthy, `3306/tcp -> 127.0.0.1:3307`.
- `prisma migrate deploy` 3 migration applied; `prisma db seed` sukses (dev); test DB terpisah.
- `npm run test:integration` → **30 lulus / 5 file** (sebelumnya tidak bisa jalan).
- `npx vitest run --project unit` → **75 lulus / 15 file**.
- `npm run typecheck` exit 0; `npm run lint` **0 error 0 warning**.
- `npm run build` sukses; `/sitemap.xml` & `/robots.txt` ter-prerender.
- `GET /sitemap.xml` → 200, XML valid, **15 URL** (9 statis + 6 fighter), 0 URL terlarang.
- `GET /robots.txt` → 200, `Disallow` + `Sitemap` + `Host` benar.
- Probe Playwright (cookie `tfn_theme=light`): class `light` sudah ada pada first paint
  (692ms), **0 mutasi class**, 0 error console; toggle → `dark` + cookie/localStorage `dark`;
  reload → SSR langsung `dark`, 0 mutasi (tanpa FOUC).

## 2026-11-17 — Phase 0: Audit & Discovery (dokumentasi saja)

**Ditambahkan**
- `docs/00-START-HERE/PHASE-0-AUDIT.md` — audit lengkap repo, DB, API, keamanan, deployment, risiko.
- `docs/00-START-HERE/` — PROJECT-OVERVIEW, QUICK-START, PROJECT-STATUS, DEVELOPMENT-GUIDE, GLOSSARY.
- `docs/01-PRODUCT/` — PRD, business rules, roles, journeys, roadmap, objectives.
- `docs/02-ARCHITECTURE/` — system, monorepo, backend, frontend, multi-tenant, auth, integrasi, modular monolith.
- `docs/03-DATABASE/` — database design, ERD, migration guide, seed data.
- `docs/04-API/API-STANDARDS.md`, `docs/08-SECURITY/{SECURITY-POLICY,RBAC}.md`,
  `docs/09-TESTING/TESTING-STRATEGY.md`, `docs/10-DEPLOYMENT/DEPLOYMENT-GUIDE.md`,
  `docs/11-DEVELOPMENT-LOG/*`, `docs/AI-CONTEXT/*`.

**Diubah**
- Tidak ada source code yang diubah.

**Diverifikasi**
- `tsc --noEmit` exit 0.
- `vitest run --project unit` → 75 lulus / 15 file.
- `eslint .` → 1 error (K-03), 1 warning.
- Probe HTTP produksi → 9 halaman 200; sitemap/robots 404.

## 2026-11-13 — Ticketing & sponsorship (riwayat repo)

- Guest checkout, PDF tiket + QR HMAC, check-in scanner, hold expiry + cron, cap pembeli.
- Sponsorship CMS (`/admin/sponsors`) + showcase di landing.
- Blok dukungan resmi Pemkab Temanggung (`OfficialSupport`).

> Riwayat lengkap sebelum audit ada di `CHANGELOG.md` root repo (27 KB) — tidak diduplikasi di sini.
