# Feature Roadmap

> Roadmap mengikuti phase di master instruction. **Tidak ada tanggal** sampai scope Phase 1 disetujui —
> estimasi tanggal tanpa baseline tim = fiksi.

| Phase | Fokus | Output yang bisa dipakai | Depends on |
|---|---|---|---|
| 0 | Audit & discovery | laporan audit, arsitektur target, task tracker | — |
| 1 | Foundation | monorepo pnpm+turbo, `web-tnf/api` (Express+Prisma) health + Swagger, `web-tnf/worker`, Docker Compose dev, logger, error handler, env validation | Phase 0 disetujui |
| 2 | Core system | `Organization`, tenant scoping, user & role per organisasi, event management lengkap (status, periode, kuota, kategori, ruleset, budget) | Phase 1 |
| 3 | Fighter & registration | club/coach, NIK/KTP/BPJS privat, consent versioned, formulir publik, verifikasi admin, invoice registrasi | Phase 2 |
| 4 | Payment, ticketing, POS | abstraksi `PaymentProvider` + QRIS + webhook idempotent, ticketing lanjutan (on-the-spot, refund), app POS, check-in multi-gate | Phase 3 |
| 5 | Competition | matchmaking + konflik jadwal, official & honor, hasil 4-eyes, championship, ranking engine | Phase 2 |
| 6 | Business | sponsorship (paket, kontrak, invoice), finance (income, expense, budget, P&L, rekonsiliasi) | Phase 4 |
| 7 | Automation | Google Sheets sync + retry, workflow ringan, notifikasi, report/export Excel/PDF | Phase 4–6 |
| 8 | Production readiness | security audit, performance, E2E, backup/restore drill, deploy baru (4 domain), monitoring | semua |

## Aturan prioritas

1. **Blocker integritas dulu**: tenant isolation, uang, authz, idempotency.
2. Fitur yang menghasilkan uang (registrasi, tiket) sebelum fitur pelaporan.
3. Jangan buka Phase N+1 sebelum gate Phase N lulus (typecheck, lint, test, build, docs).
4. Setiap phase harus meninggalkan sistem yang **bisa dipakai**, bukan setengah jadi di semua tempat.
