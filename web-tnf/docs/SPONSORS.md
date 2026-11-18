# SPONSORS.md — Sponsor & Mitra (CMS-managed)

> Status: **implemented & verified** (unit + typecheck + lint + production build + Playwright E2E
> on `next start` port 3015, 2026-11-16). Model `Sponsor` sudah ada di Prisma sejak awal — modul ini
> **tidak menambah migrasi**.

---

## 1. Apa yang dibangun

Sebelumnya logo sponsor hanya mungkin lewat registry statis (`src/lib/site/partners.ts`). Sekarang
sponsor komersial dikelola dari CMS dan dirender di beranda, mengikuti pola modul `hero-slides`:
server actions + client manager di dalam `(dashboard)`, bukan arsitektur baru.

| Lapisan | Berkas |
|---|---|
| Konstanta tier | `src/lib/sponsors/tiers.ts` |
| Service baca publik | `src/server/services/sponsor.service.ts` |
| Server actions (CRUD) | `src/app/admin/(dashboard)/sponsors/actions.ts` |
| Halaman admin (guard) | `src/app/admin/(dashboard)/sponsors/page.tsx` |
| UI admin | `src/components/admin/SponsorManager.tsx` |
| Render beranda | `src/components/landing/SponsorShowcase.tsx` |
| Navigasi sidebar | `src/app/admin/(dashboard)/layout.tsx` → "Sponsor & Mitra" |
| Test | `tests/unit/sponsor.test.ts` (11 test) |
| Probe browser | `scripts/verify/sponsor-e2e.cjs` |

---

## 2. Model data

```prisma
model Sponsor {
  id        String     @id @default(cuid())
  name      String     @db.VarChar(120)
  logoId    String?                 // FK → MediaAsset
  url       String?    @db.VarChar(500)
  tier      String     @default("PARTNER") @db.VarChar(32)
  sortOrder Int        @default(0)
  isActive  Boolean    @default(true)
  logo      MediaAsset? @relation("SponsorLogo", fields: [logoId], references: [id], onDelete: SetNull)
  @@index([isActive, sortOrder])
}
```

- **Tidak ada enum `SponsorTier`.** `tier` adalah `VarChar(32)`; nilainya dinormalisasi di
  `src/lib/sponsors/tiers.ts` sehingga baris lama/typo tidak pernah membuat render gagal
  (fallback `PARTNER`).
- Logo **bukan** kolom string. Setiap logo menjadi satu baris `MediaAsset` (`kind = IMAGE`), jadi
  admin cukup menempelkan path (`/images/sponsors/foo.png`) atau URL `https://…` — persis seperti
  alur Hero Banner. Belum ada uploader; itu pekerjaan terpisah.

### Tier yang dikenal

| Key | Label ID |
|---|---|
| `PLATINUM` | Sponsor Platinum |
| `GOLD` | Sponsor Gold |
| `SILVER` | Sponsor Silver |
| `PARTNER` | Mitra Pendukung |

Tier di luar daftar **ditolak eksplisit** di server action (`"Tier sponsor tidak dikenal"`), bukan
diam-diam diubah.

---

## 3. Alur admin

1. Login → sidebar **Sponsor & Mitra** (butuh permission `content.manage`).
2. **+ TAMBAH SPONSOR** → isi Nama (wajib), Tier, Urutan Tampil, Path/URL Logo, Situs Web
   (opsional), centang "Tampilkan logo di beranda publik".
3. Simpan → toast `Sponsor berhasil ditambahkan`, daftar ter-refresh (`router.refresh()`).
4. Aksi per baris: geser urutan (▲/▼), **SEMBUNYIKAN/TAMPILKAN**, edit, hapus.
5. Indikator `N/M TAMPIL DI BERANDA` di header menghitung sponsor aktif.

Guard server (bukan hanya UI): setiap action memanggil `verifyRequestOrigin()` lalu
`requirePermission("content.manage")`, dan `revalidatePath()` untuk `/admin/sponsors`, `/`, `/tickets`.

### Validasi yang dikembalikan ke operator

| Kasus | Pesan |
|---|---|
| Nama kosong | `Nama sponsor wajib diisi` |
| Nama > 120 karakter | `Nama sponsor maksimal 120 karakter` |
| Tier tak dikenal | `Tier sponsor tidak dikenal` |
| Logo bukan path lokal / http(s) | `Logo harus berupa path lokal (/images/...) atau URL http(s)` |
| URL situs invalid | `URL situs sponsor tidak valid` |

Pesan ini sampai apa adanya ke UI karena dilempar sebagai **`DomainValidationError`** dan kelas itu
terdaftar di `domainErrors` (`src/lib/actions/result.ts`). Sebelum perbaikan ini, `actionError()`
menelannya menjadi "Something went wrong" — itulah bug yang diperbaiki di iterasi ini.

---

## 4. Render publik (beranda)

`getPublicSponsors()` (server) memfilter:

```ts
where: { isActive: true, OR: [{ logoId: null }, { logo: { deletedAt: null } }] }
orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
```

`SponsorShowcase` lalu:

- **`return null` bila daftar kosong** — tidak ada placeholder, tidak ada klaim sponsor fiktif.
  Ini aturan repo ("no unverified sponsor claims") dan sudah diverifikasi live: dengan 0 baris di
  DB, `sponsor-showcase-heading` tidak ada di HTML beranda.
- Mengelompokkan per tier urut PLATINUM → PARTNER, judul `Didukung oleh` (EN: `Backed by`).
- Logo `grayscale` + `opacity-80`, menjadi berwarna saat hover; tanpa `logoUrl` ditampilkan nama
  sponsor sebagai teks — tidak pernah lambang rekaan.
- Link keluar memakai `rel="noopener noreferrer nofollow sponsored"`.

---

## 5. Verifikasi (bukti, bukan asumsi)

| Gate | Hasil |
|---|---|
| `npx vitest run --project unit` | **75/75 lulus** (11 di antaranya sponsor) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | bersih |
| `npm run build` | exit 0 |
| E2E `node scripts/verify/sponsor-e2e.cjs` (produksi, port 3015) | login → `/admin/sponsors` → isi form → submit → toast `Sponsor berhasil ditambahkan` → baris muncul di daftar `2/2 TAMPIL DI BERANDA` → beranda menampilkan blok `SPONSOR & MITRA RESMI / DIDUKUNG OLEH` dengan logo ter-load (`naturalWidth = 400`) |
| Fail-safe kosong | DB dikosongkan → `sponsor-showcase-heading` = 0 di HTML beranda |

Catatan operasional saat menjalankan probe: berkas baru di `public/` **tidak** terlihat oleh
`next start` yang sudah berjalan — restart server setelah menambah aset.

---

## 6. Menambah logo sponsor sungguhan

1. Taruh berkas di `public/images/sponsors/` (PNG transparan ≥400 px, atau SVG).
2. Admin → Sponsor & Mitra → Tambah/Edit → tempel `/images/sponsors/<berkas>`.
3. Isi Situs Web hanya bila URL-nya benar-benar resmi.
4. Simpan, lalu cek beranda (blok muncul hanya jika status AKTIF).

Hapus sponsor yang kerja samanya berakhir — **jangan** hanya menyembunyikan bila klaimnya sudah
tidak berlaku; sembunyikan (`SEMBUNYIKAN`) hanya untuk sponsor yang masih aktif tapi ingin
diparkir sementara.

---

## 7. Batas yang belum dikerjakan

- Uploader berkas (saat ini path/URL manual, sama seperti Hero Banner).
- Bukti kontrak/tanggal kerja sama per sponsor (belum ada kolomnya; lihat `ASSUMPTIONS.md`).
- Penempatan sponsor selain beranda (mis. `/tickets`, halaman event).
- Laporan impresi/klik.
