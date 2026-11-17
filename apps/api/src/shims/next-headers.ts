/**
 * Shim `next/headers` untuk `apps/api`.
 *
 * `auth.service` di `apps/web` punya adapter default ke `next/headers`, dan `apps/api` mengimpor
 * service itu (fase strangler). API tidak punya runtime Next, jadi modul ini menggantikannya saat
 * bundling: **memanggil** `cookies()` di API selalu salah, jadi gagalnya harus berisik.
 *
 * Kalau error ini muncul, artinya ada pemanggil auth di `apps/api` yang lupa menyuntik
 * `createExpressCookieJar(req, res)`.
 */
export function cookies(): never {
  throw new Error(
    "next/headers.cookies() dipanggil di apps/api — sunttikkan SessionCookieJar " +
      "(createExpressCookieJar) ke getSession/setSessionCookie/destroySession."
  );
}

export function headers(): never {
  throw new Error("next/headers.headers() tidak tersedia di apps/api.");
}
