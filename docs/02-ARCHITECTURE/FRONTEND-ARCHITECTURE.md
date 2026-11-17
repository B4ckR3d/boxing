# Frontend Architecture

> Bagian 1 = **kondisi nyata hari ini**. Bagian 2 = target.

## 1. Kondisi sekarang (satu app Next.js 16)

```
src/app/
├── layout.tsx                 root: <html>, theme, language, Toaster, CSP nonce
├── (public)/                  layout sendiri + <main>
│   ├── page.tsx               landing sinematik
│   ├── tickets/               beli, status, PDF route
│   ├── fighters/              direktori + [slug]
│   ├── events/ rankings/ belts/ fights/ grand-prix/ news/
├── admin/
│   ├── login/
│   └── (dashboard)/           layout: sidebar + guard
│       ├── page.tsx           dashboard
│       ├── fighters|events|belts|rankings|grand-prix
│       ├── ticketing (+ /scan)
│       ├── sponsors|hero-slides|settings|users|roles|audit-logs
└── api/                       auth/login, auth/logout, ticketing/orders[…]
```

### Pola yang dipakai

- **RSC-first**: data diambil di server; deep link (status tiket) di-resolve server-side.
- **Server actions** untuk mutasi admin, return `ActionResult`.
- **TanStack Query** tersedia untuk komponen client yang butuh cache.
- **Tailwind v4 dengan design token** (`globals.css`), bukan shadcn/ui — komponen sendiri di `src/components/ui`.
- **i18n**: `src/lib/i18n` + `LanguageProvider` (ID/EN) untuk landing.
- **Tema**: light/dark via class di `<html>` + script init nonce.

### Batasan yang harus dipertahankan

| Aturan | Alasan |
|---|---|
| Satu `<main>` per halaman (layout yang punya) | a11y tree |
| Halaman tidak fetch data di `useEffect` untuk first paint | lint + SEO |
| `<Button asChild>` untuk link berbentuk tombol | dua target klik |
| Angka `Decimal` dikonversi sebelum lintas RSC boundary | serialisasi |

## 2. Target (3 app terpisah)

| App | Karakter UI | Catatan |
|---|---|---|
| `website` | branding, sinematik, SEO, mobile-first, bilingual | tetap RSC; fetch ke API dengan service token |
| `admin` | produktivitas: data table, filter, form, workflow | kepadatan informasi > dekorasi |
| `pos` | kecepatan: tombol besar, keyboard/scan-friendly, offline-tolerant | wajib nyaman di HP/tablet |

**Jangan** menyatukan ketiganya dalam satu dashboard generik: kebutuhan dan ritme kerjanya berbeda.

### Design system

- Token warna/spacing/typography di `packages/ui` (diekstrak dari `globals.css` sekarang).
- Komponen wajib dipakai ulang; jangan menduplikasi tombol/kartu/tabel per app.
- Aksesibilitas: kontras, focus ring, target sentuh ≥ 44px di POS.

## 3. State management target

| Jenis state | Alat |
|---|---|
| Server state (data API) | TanStack Query (cache, invalidate setelah mutasi) |
| UI state lokal | `useState` / `useReducer` |
| State lintas komponen dalam satu app | Zustand (keranjang POS, sesi kasir) |
| Form | React Hook Form + Zod resolver |

## 4. Aturan integrasi dengan API

1. Semua tipe response berasal dari `packages/types` — tidak ada `any`.
2. Error envelope ditangani terpusat di `api-client`, bukan try/catch tersebar.
3. Tidak ada mock data pada fitur yang sudah masuk tahap integrasi; mock hanya untuk prototyping
   dan wajib ditandai `MOCK`.
4. Frontend tidak pernah memegang secret; hanya `NEXT_PUBLIC_*` yang aman.
