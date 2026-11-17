# Product Requirements

Sumber: master instruction proyek (17 Nov 2026). Dokumen ini merangkum kebutuhan yang **mengikat**
dan menandai mana yang sudah ada di kode. Detail bukti: `../00-START-HERE/PHASE-0-AUDIT.md`.

## 1. Aplikasi

| App | Domain target | Fungsi | Status |
|---|---|---|---|
| website | `tfn.pimpom.id` | publik: event, fighter, ranking, tiket, registrasi, sponsor, berita | 🟡 ada (seed demo, belum punya registrasi) |
| admin | `admin.tfn.pimpom.id` | seluruh pengelolaan | 🟡 ada, path `/admin` di domain yang sama |
| pos | `pos.tfn.pimpom.id` | kasir tiket + check-in | ❌ belum ada |
| api | `api.tfn.pimpom.id` | REST `/api/v1` untuk semua app | ❌ belum ada (masih route handler Next.js) |
| worker | internal | job async (expiry, sync, notifikasi) | ❌ belum ada (masih script + cron) |

## 2. Halaman publik wajib

Home · About · Events · Event Detail · Fighter Directory · Fighter Profile · Fighter Ranking ·
Championship · Match Schedule · Match History · Rules & Regulations · Sponsorship ·
Online Registration · Online Ticketing · Contact.

Status: 8 dari 15 ada (belum: About, Event Detail, Match Schedule terpisah, Rules, Sponsorship page,
Online Registration, Contact).

## 3. Modul admin wajib

A Dashboard · B Organization · C Event · D Fighter · E Club/Gym · F Registration · G Match ·
H Championship · I Ranking · J Official · K Sponsorship · L Ticketing · M POS · N Finance ·
O Workflow · P Spreadsheet · Q User & Permission.

| Modul | Status |
|---|---|
| A, C(sebagian), D, G(sebagian), H, I, L, Q | 🟡 ada |
| B, E, F, J, K(lanjutan), M, N, O, P | ❌ belum ada |

## 4. Kebutuhan non-fungsional

- **Keamanan:** data NIK/KTP/BPJS privat; tidak ada secret di frontend; webhook signature; audit log.
- **Integritas data:** uang `Decimal`; transaksi DB untuk proses finansial; tidak menghapus transaksi final.
- **Multi-tenant & multi-event:** setiap query data bisnis wajib ter-scope organisasi dan/atau event.
- **API-first:** semua konsumen (website/admin/pos/worker) memakai API yang sama; tidak ada akses DB langsung dari frontend.
- **Dokumentasi:** setiap perubahan arsitektur/DB/API/business rule/security/deploy diperbarui.
- **Performa:** halaman publik mobile-first; POS harus responsif di HP/tablet.
- **i18n:** ID wajib, EN opsional (sudah ada untuk landing).

## 5. Batasan keras

1. POS hanya tiket — tanpa katalog F&B, tanpa stok F&B.
2. Spreadsheet bukan database utama.
3. Jangan mengarang harga/aturan/status yang tidak diberikan penyelenggara → tandai `NEEDS CLARIFICATION`.
4. Jangan tampilkan NIK/KTP/BPJS di halaman publik, dalam bentuk apa pun.
