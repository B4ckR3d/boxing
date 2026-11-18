/**
 * Tautan ke aplikasi ticketing terpisah (`ticket-tnf`).
 *
 * Sejak 18 Nov 2026 web-tnf **tidak lagi** menjual tiket sendiri: seluruh alur tiket
 * (pilih tiket → bayar → tiket PDF → check-in gate) hidup di `ticket-tnf`. Modul ini satu-satunya
 * tempat base URL itu ditentukan, supaya kalau domain tiket berubah hanya satu baris yang diedit.
 *
 * `NEXT_PUBLIC_` dipakai karena file ini juga diimpor komponen client (Navbar/Hero/Footer).
 * Tidak ada rahasia di sini — hanya URL publik.
 */
const RAW = process.env.NEXT_PUBLIC_TICKETING_URL ?? "http://localhost:3010";

/** Base URL tanpa trailing slash, mis. `https://tiket.tfn.id`. */
export const TICKETING_BASE = RAW.replace(/\/+$/, "");

/** URL absolut ke sebuah path di aplikasi ticketing (`ticketingUrl("/events/x")`). */
export function ticketingUrl(pathname = "/"): string {
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${TICKETING_BASE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
