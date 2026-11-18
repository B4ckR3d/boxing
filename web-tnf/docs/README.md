# Dokumentasi TFN Management Platform

> Indeks dokumentasi. **Baca `00-START-HERE/PHASE-0-AUDIT.md` lebih dulu** jika kamu developer/AI baru.
> Status terakhir diperbarui: Phase 0 (Audit & Discovery) — 17 November 2026.

## Cara pakai dokumentasi ini

1. `00-START-HERE/PROJECT-OVERVIEW.md` — apa yang dibangun dan untuk siapa.
2. `00-START-HERE/PHASE-0-AUDIT.md` — kondisi nyata repo hari ini (bukti, bukan asumsi).
3. `AI-CONTEXT/AI-INSTRUCTIONS.md` — aturan wajib untuk AI coding agent.
4. `AI-CONTEXT/CURRENT-STATE.md` + `AI-CONTEXT/NEXT-TASKS.md` — posisi pekerjaan & langkah berikutnya.
5. `11-DEVELOPMENT-LOG/TASK-TRACKER.md` — status per task (TFN-001 … TFN-020).

## Status dokumen

Legenda: ✅ ditulis & relevan · 🟡 kerangka/target design (belum ada implementasi) · ⬜ belum ditulis (dibuat pada phase terkait)

| Folder | Dokumen | Status | Catatan |
|---|---|---|---|
| 00-START-HERE | PROJECT-OVERVIEW.md | ✅ | |
| 00-START-HERE | PHASE-0-AUDIT.md | ✅ | laporan audit Phase 0 |
| 00-START-HERE | QUICK-START.md | ✅ | menjalankan proyek hari ini |
| 00-START-HERE | PROJECT-STATUS.md | ✅ | ringkas, selalu diperbarui |
| 00-START-HERE | DEVELOPMENT-GUIDE.md | ✅ | alur kerja + gate verifikasi |
| 00-START-HERE | GLOSSARY.md | ✅ | istilah domain |
| 01-PRODUCT | PRODUCT-REQUIREMENTS.md | ✅ | kebutuhan dari master instruction |
| 01-PRODUCT | BUSINESS-RULES.md | ✅ | aturan bisnis + angka yang sudah pasti |
| 01-PRODUCT | USER-ROLES.md | 🟡 | role target → permission (belum semua diimplementasi) |
| 01-PRODUCT | USER-JOURNEYS.md | ✅ | alur utama |
| 01-PRODUCT | FEATURE-ROADMAP.md | 🟡 | rencana per phase |
| 01-PRODUCT | BUSINESS-OBJECTIVES.md | ✅ | |
| 02-ARCHITECTURE | SYSTEM-ARCHITECTURE.md | 🟡 | arsitektur target |
| 02-ARCHITECTURE | MONOREPO-STRUCTURE.md | 🟡 | rencana struktur |
| 02-ARCHITECTURE | BACKEND-ARCHITECTURE.md | 🟡 | konvensi Express/Prisma |
| 02-ARCHITECTURE | FRONTEND-ARCHITECTURE.md | ✅ | kondisi existing + target |
| 02-ARCHITECTURE | MULTI-TENANT-ARCHITECTURE.md | 🟡 | belum diimplementasi |
| 02-ARCHITECTURE | AUTHENTICATION-FLOW.md | ✅ | sesuai implementasi |
| 02-ARCHITECTURE | INTEGRATION-ARCHITECTURE.md | 🟡 | payment/Sheets/queue |
| 02-ARCHITECTURE | MODULAR-MONOLITH.md | 🟡 | |
| 03-DATABASE | DATABASE-DESIGN.md | ✅ | existing 40 model + target |
| 03-DATABASE | ERD.md | ✅ | Mermaid, existing |
| 03-DATABASE | MIGRATION-GUIDE.md | ✅ | strategi + aturan migration |
| 03-DATABASE | SEED-DATA.md | ✅ | isi database hari ini |
| 03-DATABASE | TABLE-DICTIONARY.md | ⬜ | menyusul saat schema target dibekukan |
| 03-DATABASE | INDEXING-STRATEGY.md | ⬜ | |
| 04-API | API-STANDARDS.md | ✅ | standar response/envelope |
| 04-API | API-ENDPOINTS.md | ⬜ | setelah API Express ada |
| 04-API | WEBHOOKS.md | ⬜ | setelah payment gateway |
| 05-MODULES | per modul | ⬜ | dibuat saat modul dikerjakan (aturan: jangan dokumentasi fiktif) |
| 06-INTEGRATIONS | per integrasi | ⬜ | menyusul |
| 07-FRONTEND | WEBSITE/ADMIN/POS/DESIGN-SYSTEM | ⬜ | |
| 08-SECURITY | SECURITY-POLICY.md | ✅ | kontrol yang benar-benar ada |
| 08-SECURITY | RBAC.md | ✅ | katalog permission existing |
| 09-TESTING | TESTING-STRATEGY.md | ✅ | |
| 10-DEPLOYMENT | DEPLOYMENT-GUIDE.md | ✅ | produksi aaPanel |
| 11-DEVELOPMENT-LOG | CHANGELOG/DECISIONS/KNOWN-ISSUES/TASK-TRACKER/HANDOVER | ✅ | |
| AI-CONTEXT | 6 file | ✅ | |

> Aturan: dokumen di folder `05-MODULES`, `06-INTEGRATIONS`, `07-FRONTEND` **baru dibuat setelah modulnya
> benar-benar ada di kode**. Dokumentasi yang mengklaim fitur belum ada dilarang.
