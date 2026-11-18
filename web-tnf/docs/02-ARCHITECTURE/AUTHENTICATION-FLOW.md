# Authentication Flow

> Bagian 1 = **implementasi saat ini** (bukan rencana). Bagian 2 = pertimbangan untuk API terpisah.

## 1. Implementasi sekarang

### Login

```
POST /api/auth/login  { email, password }
  → rate limit (per IP + per akun)
  → verifyRequestOrigin()  (Origin harus == APP_URL)  → 403 bila beda
  → cek user aktif & tidak locked
  → Argon2id verify password
  → gagal: failedLoginCount++, lockout setelah N kali
  → sukses: buat session token acak 32 byte
            simpan sha256(token) di tabel Session (+ ip, userAgent, expiresAt)
            set cookie httpOnly, secure, sameSite=lax
  → bila role requiresMfa: minta langkah TOTP (AES-256-GCM decrypted secret)
  → audit log LOGIN_SUCCESS / LOGIN_FAILED
```

### Setiap request terlindungi

```
cookie → hash → cari Session (belum expired, belum idle-timeout)
      → muat User + Role + Permission
      → requirePermission('...') pada server action / route handler
```

### Logout

`POST /api/auth/logout` → hapus baris `Session`, clear cookie, audit.

### Perlindungan yang sudah ada

| Kontrol | Detail |
|---|---|
| Password | Argon2id (memory-hard) |
| Session token | opaque 32 byte, disimpan `sha256`, tidak bisa dipakai jika DB bocor tanpa token asli |
| Cookie | `httpOnly`, `secure`, `sameSite=lax` |
| Lockout | `failedLoginCount` + `lockedUntil` |
| MFA | TOTP RFC 6238, secret terenkripsi AES-256-GCM |
| CSRF | origin check pada semua mutasi |
| Session hygiene | TTL + idle timeout, sesi lama dihapus |
| Audit | login/logout/perubahan role tercatat |

### Keterbatasan yang diketahui

- Tidak ada refresh token (pola session tidak memerlukannya).
- Cookie berlaku untuk satu host; **subdomain admin/api butuh keputusan** (ADR-002).
- Rate limit in-memory → tidak akurat bila ada >1 instance.

## 2. Pertimbangan saat API dipisah

| Opsi | Untung | Rugi |
|---|---|---|
| A. Cookie sesi ber-`Domain=.tfn.pimpom.id` | sederhana, tidak ada token di JS | perlu CSRF yang matang; semua app satu domain |
| B. Access token (15 mnt) + refresh token rotation, disimpan di cookie httpOnly per app | standar API publik, siap mobile | kompleks: rotasi, deteksi reuse, revokasi |
| C. Session cookie untuk app internal + service token untuk RSC website | pemisahan bersih | dua mekanisme |

**Rekomendasi awal (belum final):** C untuk website (RSC → API dengan service token) dan A untuk
admin/POS pada fase awal; pindah ke B bila ada kebutuhan klien eksternal/mobile.

Aturan yang tidak berubah apa pun opsinya:
- Password tidak pernah plaintext.
- Token tidak disimpan di `localStorage` tanpa pertimbangan (dan default-nya: jangan).
- Setiap mutasi tetap butuh origin/CSRF protection.
- Rotasi `AUTH_SECRET`/`ENCRYPTION_KEY` = semua sesi & tiket PDF lama invalid → dokumentasikan saat deploy.
