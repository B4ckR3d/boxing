# Security Policy

> Hanya berisi kontrol yang **benar-benar ada** di kode (✅) atau yang wajib dibangun (⬜).

## 1. Autentikasi & sesi

| Kontrol | Status | Lokasi |
|---|---|---|
| Password hashing Argon2id | ✅ | `src/lib/security/password.ts` |
| Session token opaque, `sha256` at rest | ✅ | `auth.service.ts`, model `Session` |
| Cookie httpOnly/secure/sameSite | ✅ | login route |
| Account lockout | ✅ | `User.failedLoginCount`, `lockedUntil` |
| MFA TOTP (secret AES-256-GCM) | ✅ | `src/lib/security/totp.ts`, `crypto.ts` |
| Origin/CSRF check pada mutasi | ✅ | `src/lib/security/csrf.ts` |
| Refresh token rotation | ⬜ | diputuskan saat API dipisah (ADR-002) |

## 2. Otorisasi

| Kontrol | Status |
|---|---|
| Permission-based RBAC, cek di server | ✅ |
| Four-eyes untuk grant/revoke role | ✅ |
| Tenant isolation | ⬜ (belum ada tenant) |
| Test deny-path (403) untuk setiap permission | 🟡 sebagian |

## 3. Data sensitif (NIK, KTP, BPJS)

| Aturan | Status |
|---|---|
| Tidak pernah tampil publik / diekspos DTO publik | ✅ untuk field yang ada (`contactEmail/Phone/privateNotes` dikecualikan dari DTO publik) |
| Field NIK/BPJS belum ada | ⬜ desain wajib sebelum modul registrasi |
| Enkripsi kolom (AES-256-GCM) untuk NIK/BPJS | ⬜ |
| Dokumen KTP di storage privat + signed URL | ⬜ |
| Permission khusus untuk melihat dokumen | ⬜ |
| Audit setiap pembacaan dokumen | ⬜ |
| Kebijakan retensi & penghapusan terdokumentasi | ⬜ |

**Larangan keras:** mengunggah KTP/dokumen pribadi ke folder `public/`, menaruh URL permanen tanpa
otorisasi, atau mengirim dokumen ke pihak ketiga tanpa dasar.

## 4. Aplikasi web

| Kontrol | Status |
|---|---|
| CSP + nonce | ✅ |
| Helmet/security headers (setara) | ✅ di `next.config.ts` |
| Sanitasi input & output (XSS) | ✅ `src/lib/security/sanitize.ts` |
| SQL injection | ✅ Prisma parameterized; tidak ada raw SQL di kode aplikasi |
| Rate limiting | 🟡 in-memory (single instance) |
| Upload validation | ⬜ (MIME, ukuran, nama file generate) |
| Secret di frontend | ✅ tidak ada; hanya `NEXT_PUBLIC_*` |
| `.env` tidak di-commit | ✅ `.gitignore` |

## 5. Webhook & pembayaran

| Kontrol | Status |
|---|---|
| Signature verification | ⬜ (belum ada gateway) |
| Idempotency | ⬜ wajib saat gateway masuk |
| Tidak percaya redirect sebagai bukti bayar | ✅ prinsip sudah dipegang (verifikasi admin manual) |
| Rekonsiliasi | ⬜ |

## 6. Operasional

| Kontrol | Status |
|---|---|
| Audit log aksi sensitif | ✅ |
| Redaksi data sensitif di log | ✅ `src/lib/security/redact.ts` |
| Backup DB | ✅ `scripts/db-backup.mjs` + `docs/BACKUP_RESTORE.md` |
| Uji restore | ⬜ belum ada bukti restore drill |
| Secret rotation terdokumentasi | 🟡 catatan: rotasi `AUTH_SECRET` membatalkan sesi & tiket PDF |
| Dependency audit | ⬜ jadwalkan `npm audit` berkala |

## 7. Aturan untuk developer

1. Jangan menambah endpoint mutasi tanpa origin check + permission.
2. Jangan menampilkan error internal ke user.
3. Jangan memakai data produksi di dev/test.
4. Jangan membuat `console.log` yang memuat token, password, NIK, atau isi dokumen.
5. Setiap temuan keamanan dicatat di `../11-DEVELOPMENT-LOG/KNOWN-ISSUES.md` sebelum diperbaiki.
