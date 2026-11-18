# Handover

> Untuk developer/AI berikutnya. Baca ini, lalu `../AI-CONTEXT/CURRENT-STATE.md` dan `NEXT-TASKS.md`.

## 1. Di mana kita

Phase 0 (audit) selesai. **Belum ada perubahan source code.** Repo masih arsitektur lama
(satu Next.js fullstack), produksi hidup di `tfn.pimpom.id` dengan data demo.

## 2. Yang harus dipahami sebelum menyentuh apa pun

1. `docs/00-START-HERE/PHASE-0-AUDIT.md` — kondisi nyata + risiko.
2. `docs/11-DEVELOPMENT-LOG/TASK-TRACKER.md` — status per task.
3. `docs/11-DEVELOPMENT-LOG/KNOWN-ISSUES.md` — 3 blocker utama (DB lokal, lint, sitemap).
4. `docs/03-DATABASE/DATABASE-DESIGN.md` §4 — invariant yang tidak boleh dilanggar.

## 3. Langkah melanjutkan (urutan aman)

1. **Perbaiki lingkungan** (TFN-021): port DB 3307, `db:up`, `db:deploy`, `db:seed`, lalu
   `npm run test:integration`. Tanpa ini, semua klaim integrasi tidak bisa diverifikasi.
2. **Selesaikan lint** (TFN-022) tanpa melanggar aturan CSP nonce.
3. **Minta keputusan** atas ADR-001 (strangler) dan ADR-003 (ULID) sebelum menulis kode Phase 1.
4. Setelah disetujui: bangun `apps/api` skeleton + pindahkan `auth`/`rbac` (modul paling stabil),
   jangan mulai dari modul bisnis baru.
5. Baru kemudian modul Organization/tenant (TFN-006) — ini prasyarat semua data bisnis nyata.

## 4. Jebakan yang sudah memakan korban

| Jebakan | Akibat |
|---|---|
| Menganggap `src/generated` ada setelah clone | typecheck gagal; jalankan `prisma generate` |
| `APP_URL` tidak sama dengan URL browser | login/mutasi 403 |
| Menambah file `public/` tanpa restart `next start` | gambar 404 (`naturalWidth = 0`) |
| `<Link><Button/></Link>` | kontrol bertumpuk, probe layout gagal |
| Fetch data di `useEffect` untuk halaman publik | lint menggagalkan build, first paint kosong |
| Menghitung kuota dari order confirmed saja | oversell |
| Menjalankan `scripts/verify/*` di DB produksi | baris & revenue palsu |

## 5. Kontak keputusan

Semua keputusan bisnis yang belum jelas ditandai **NEEDS CLARIFICATION** di
`01-PRODUCT/BUSINESS-RULES.md` §6 — jangan diisi dengan asumsi.
