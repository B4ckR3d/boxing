# Deployment Guide

> Dokumen ini merangkum kondisi nyata. Prosedur detail ada di `../DEPLOYMENT.md` (existing) dan
> `../BACKUP_RESTORE.md`.

## 1. Produksi saat ini

| Item | Nilai |
|---|---|
| Host | VPS dengan aaPanel |
| App dir | `/www/wwwroot/boxing` |
| Proses | satu Next.js (`next start`) port 3000, dikelola aaPanel/PM2 |
| Domain | `tfn.pimpom.id` (admin di path `/admin`) |
| Database | MySQL lokal di host yang sama |
| Queue | tidak ada (cron hourly untuk hold expiry) |
| Storage | disk lokal / S3 SDK (belum dipakai penuh) |
| Cron | `17 * * * *` → `scripts/cron/expire-holds.sh` (flock + log rotasi) |

## 2. Deploy (kondisi sekarang)

```bash
cd /www/wwwroot/boxing
git pull
npm ci                 # tsx WAJIB ikut (bukan devDependency)
npx prisma migrate deploy
npm run build
# restart proses Next.js dari aaPanel / PM2
```

Catatan penting:
- **Jangan** `npm ci --omit=dev` tanpa memastikan `tsx` ada sebagai dependency (sudah diperbaiki di commit `c0b7cc4`).
- Migration dijalankan manual, bukan otomatis saat start.
- Setelah deploy, jalankan smoke test: `/`, `/tickets`, `/admin/login`, satu pembelian tiket di staging.

## 3. Environment variable wajib

| Key | Catatan |
|---|---|
| `NODE_ENV=production` | — |
| `APP_URL` | harus `https://tfn.pimpom.id` (origin check) |
| `MYSQL_*` / `DATABASE_URL` | kredensial produksi (jangan dipakai di dev) |
| `AUTH_SECRET`, `ENCRYPTION_KEY` | 32-byte base64; rotasi = logout massal + tiket PDF lama invalid |
| `AUTH_ENFORCE_MFA` | disarankan `true` untuk role sensitif |
| `STORAGE_DRIVER`, `S3_*` | bila memakai object storage |
| `DEMO_USER_PASSWORD` | **jangan** dipakai di produksi; gunakan bootstrap admin |

## 4. Target deployment (setelah restrukturisasi)

| Service | Port | Docker |
|---|---|---|
| website | 3000 | `infrastructure/docker/website.Dockerfile` |
| admin | 3001 | `admin.Dockerfile` |
| pos | 3002 | `pos.Dockerfile` |
| api | 4000 | `api.Dockerfile` |
| worker | — | `worker.Dockerfile` |
| mysql | internal | image `mysql:8.4` |
| redis | internal | image `redis:7` |

Nginx: satu vhost per domain, `client_max_body_size` cukup untuk upload KTP (mis. 5 MB), rate limit
pada `/api/v1/auth/*`, header keamanan, TLS dari aaPanel/Let's Encrypt.

## 5. Checklist produksi (ringkas)

- [ ] Backup DB terbaru + uji restore
- [ ] Migration diuji di salinan data
- [ ] Health check endpoint merespons
- [ ] Smoke test alur tiket & login admin
- [ ] Cron terpasang (`install.sh status`)
- [ ] Log berputar (jangan sampai disk penuh)
- [ ] Rollback plan jelas (kode + data)

## 6. Temuan audit yang harus dibereskan sebelum deploy berikutnya

1. `/sitemap.xml` dan `/robots.txt` → 404 di produksi.
2. `admin.tfn.pimpom.id`, `api.tfn.pimpom.id`, `pos.tfn.pimpom.id` belum ada (DNS + vhost).
3. Lint gagal → jangan deploy dari working tree yang tidak bersih.
