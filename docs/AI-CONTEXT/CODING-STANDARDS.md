# Coding Standards (ringkas & operasional)

## TypeScript

- `strict: true`; tidak ada `any` (`@typescript-eslint/no-explicit-any` = error).
- Tipe response API berasal dari `packages/types` (target) / `src/lib/**/types.ts` (sekarang).
- Union + discriminated result untuk hasil operasi (`ActionResult`), bukan `throw` untuk validasi UI.
- Gunakan `unknown` + Zod parse untuk data eksternal.

## Penamaan

| Konteks | Gaya |
|---|---|
| File komponen | `PascalCase.tsx` |
| File non-komponen | `kebab-case.ts` |
| Service/repository | `<domain>.service.ts`, `<domain>.repository.ts` |
| Boolean | `is/has/can` prefix |
| Enum DB | `SCREAMING_SNAKE` |

## Fungsi & modul

- Fungsi kecil, satu tanggung jawab, nama menjelaskan perilaku.
- Business logic tidak di controller, tidak di komponen React.
- Hindari file service raksasa: pecah per use-case bila > ~400 baris.
- Tanpa abstraksi prematur: interface hanya bila ada ≥2 implementasi nyata atau batas integrasi
  (contoh sah: `PaymentProvider`).

## Error handling

- Domain error: kelas spesifik (`CapacityError`, `PurchaseLimitError`, `DomainValidationError`, …).
- Global error handler memetakan ke envelope + HTTP status.
- Jangan menelan error diam-diam (`catch {}` tanpa log = dilarang).
- Log: sertakan `requestId`, jangan sertakan PII/token.

## Frontend

- Server-first: data di RSC / loader; `useEffect` bukan alat fetch pertama.
- Form: React Hook Form + Zod (skema sama dengan backend bila memungkinkan).
- Komponen presentational murni; jangan campur fetch + presentasi di satu file besar.
- Aksesibilitas: label, focus state, kontras, target sentuh ≥44px (POS).

## Database/Prisma

- Query lewat repository modul; tidak ada `prisma` import di komponen.
- Transaksi untuk multipel write yang harus konsisten.
- Select eksplisit (hindari `select *` implisit pada data sensitif).

## Git & commit

- Commit kecil & fokus; pesan menjelaskan **mengapa**.
- Jangan commit `.env`, `cred.md`, `src/generated`, `storage/`, `public/uploads/*`.
- Sebelum commit: `typecheck` + `lint` + test terkait.

## Dokumentasi kode

- JSDoc singkat untuk fungsi penting (tujuan + perilaku + efek samping).
- Komentar untuk keputusan non-obvious (contoh: "kuota dihitung termasuk hold agar tidak oversell").
