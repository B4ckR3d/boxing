# Known Issues

| ID | Severity | Isu | Dampak | Rencana |
|---|---|---|---|---|
| K-01 | Medium | `/sitemap.xml` & `/robots.txt` → **404 di produksi** meski dokumen menyebut ada | SEO/indexing | TFN-023: cek route/metadata, verifikasi di build produksi |
| K-02 | High | DB lokal tidak bisa dipakai: port 3306 dipakai MariaDB sistem, volume `tfn_boxing_mysql_data` kosong (0 tabel) | developer baru & integration test terblokir | TFN-021 |
| K-03 | High | `npm run lint` gagal: `src/app/layout.tsx:69` `dangerouslySetInnerHTML` (perubahan belum commit) | gate DoD gagal, risiko deploy dari tree kotor | TFN-022 |
| K-04 | Medium | `admin/api/pos.tfn.pimpom.id` belum ada | sesuai spec belum tercapai; POS tidak bisa dipisah | Phase 4/8 |
| K-05 | Medium | Rate limit in-memory | bypass bila >1 instance | Redis saat `apps/api` dibangun |
| K-06 | Medium | Belum ada payment gateway; verifikasi transfer manual | registrasi berbayar belum otomatis, rawan human error | TFN-010 |
| K-07 | High | Produksi menampilkan **data demo** (event `WBC-X 42`, 6 fighter fiktif, 0 sponsor) | kredibilitas & kebingungan publik | ganti setelah modul event TFN siap (TFN-007) |
| K-08 | Low | `src/generated/` di-gitignore | clone baru wajib `prisma generate` (postinstall sudah) | dokumentasi cukup |
| K-09 | Low | Warning lint `rgb` unused di `scripts/verify/official-crest.cjs` | noise | rapikan saat menyentuh file itu |
| K-10 | Medium | Integration test tidak bisa diverifikasi saat audit | klaim "58 test lulus" hanya historis, bukan hasil audit | setelah K-02 beres, jalankan ulang |
| K-11 | Low | Tidak ada uji restore backup | risiko backup tidak valid | drill restore sebelum go-live fitur baru |
| K-12 | Medium | Belum ada `Organization`/tenant | data bisnis nyata tidak boleh masuk sebelum ini ada | TFN-006 |

## Catatan

Bukan bug (sengaja): tidak ada email/notifikasi, tidak ada refund, tidak ada penomoran kursi,
scanner butuh koneksi online, cap pembeli tidak memakai lock global (lihat `docs/API.md`).
