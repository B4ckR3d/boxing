# Modular Monolith

> **Status: 🟡 target.** Repo saat ini satu app Next.js; pemisahan modul masih longgar
> (`src/server/services/*` + `src/app/api/*`).

## 1. Mengapa modular monolith, bukan microservices

| Alasan | Penjelasan |
|---|---|
| Skala tim kecil | 1–3 developer; microservices = biaya operasional tanpa manfaat |
| Data sangat relasional | registrasi–payment–match–finance saling terkait, butuh transaksi DB |
| Konsistensi finansial | transaksi lintas modul lebih aman dalam satu database |
| Rilis sederhana | satu pipeline, satu migration |

Batas modul tetap tegas supaya pemisahan **mungkin** dilakukan nanti bila benar-benar perlu.

## 2. Aturan modul

1. Satu modul = satu domain bisnis (registrations, payments, finance, …).
2. Modul hanya mengekspor **service publik**; repository & model internal tidak diekspor.
3. Modul tidak boleh mengimpor repository modul lain.
4. Ketergantungan lintas modul memakai service atau event internal, bukan join SQL lintas domain
   di luar repository pemilik data.
5. Setiap modul punya test sendiri; test lintas modul ditempatkan di level integration.

## 3. Peta ketergantungan (target)

```
registrations ──▶ fighters, clubs, events, payments(create invoice)
payments      ──▶ finance(record income)  [via event, bukan import langsung]
ticketing     ──▶ payments, finance
pos           ──▶ ticketing
matches       ──▶ registrations, officials, championships, rankings
finance       ──▶ (tidak bergantung ke modul transaksi; menerima event/posting)
reports       ──▶ read-model dari modul lain (query terbatas, read-only)
```

## 4. Anti-pola yang dilarang

- Service "god" yang menyentuh semua tabel.
- Controller berisi logika bisnis.
- Modul A menulis langsung ke tabel milik modul B.
- Circular dependency antar modul (deteksi di review + lint import boundaries).
- Abstraksi prematur (interface untuk hal yang hanya punya satu implementasi dan tidak akan berubah).
