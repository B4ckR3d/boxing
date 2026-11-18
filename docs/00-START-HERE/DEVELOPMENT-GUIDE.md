# Development Guide

## Alur kerja wajib per task

```
Requirement → Technical design → DB design → API design → Implementasi
→ Validasi → Test → Dokumentasi → Review → Completion report
```

Satu iterasi = satu task. Jangan mencampur dua modul dalam satu commit besar.

## Definition of Done (tidak bisa dinegosiasi)

- [ ] Acceptance criteria task terpenuhi
- [ ] `npm run typecheck` exit 0
- [ ] `npm run lint` bersih (0 error)
- [ ] Test relevan lulus — **skipped/timeout ≠ lulus**
- [ ] `npm run build` exit 0
- [ ] Endpoint benar-benar dipanggil dari UI (bukan hanya ada file)
- [ ] Authorization diuji (permission ditolak = 403, bukan hanya UI disembunyikan)
- [ ] Dokumentasi + task tracker diperbarui dengan bukti

## Konvensi kode yang sudah berlaku di repo

| Topik | Aturan | Alasan |
|---|---|---|
| Server action | Return `ActionResult` (`{ ok } | { ok:false, error }`), client wajib baca `result.ok` & toast | fire-and-forget = tombol mati |
| Mutasi | `verifyRequestOrigin()` + `requirePermission()` | UI hiding bukan security |
| Error domain | `DomainValidationError` (terdaftar di `src/lib/actions/result.ts`) | kalau `throw new Error`, pesan jadi "Something went wrong" |
| Angka uang | `Decimal` di DB; `Number()` saat render; `String()` lintas RSC boundary | presisi |
| Query data | Resolve di server (`await searchParams`), jangan `useEffect` | lint `react-hooks/set-state-in-effect` menggagalkan build |
| Layout | Halaman **tidak** merender `<main>` (layout sudah punya) | a11y: satu landmark |
| Tombol + link | `<Button asChild><Link/></Button>`, **jangan** `<Link><Button/></Link>` | dua target klik bertumpuk |
| Enum → UI | Render lewat `src/lib/ticketing/labels.ts` | nilai storage bukan copy |
| Aset baru di `public/` | Restart `next start` | file baru 404 pada proses lama |

## Struktur backend saat ini (dan targetnya)

Sekarang: `src/app/api/*` (route handler) + `src/server/services/*` + `src/lib/*`.
Target: `web-tnf/api/src/modules/<module>/{routes,controller,service,repository,validation,types,tests}.ts`.
Selama transisi: **logika bisnis tetap di service layer**, route handler hanya HTTP.

## Menambah migration (Prisma)

```bash
# 1) dokumentasikan dulu (docs/03-DATABASE/DATABASE-DESIGN.md + ERD)
# 2) ubah prisma/schema.prisma
npx prisma migrate dev --name <nama_perubahan>     # dev
npx prisma migrate deploy                          # staging/prod (lewat prosedur deploy)
```

Aturan: tidak ada migration destruktif tanpa backup; kolom uang `Decimal(14,2)`; timestamp UTC;
tabel baru yang menyimpan data tenant wajib punya `organizationId`.

## Menjalankan test

```bash
npm run test          # unit (tanpa DB)
npm run test:integration   # butuh TEST_DATABASE_URL yang sudah dimigrasi
npm run test:all
```

## Sebelum menutup sesi (wajib)

Perbarui: `PROJECT-STATUS.md`, `../11-DEVELOPMENT-LOG/CHANGELOG.md`, `TASK-TRACKER.md`,
`../AI-CONTEXT/CURRENT-STATE.md`, `NEXT-TASKS.md`, `SESSION-HANDOVER.md`.
Isi harus sesuai kode sebenarnya, bukan rencana.
