/**
 * Adapter cookie untuk `auth.service` (persiapan Langkah B).
 *
 * `auth.service.ts` butuh tiga operasi cookie: baca, tulis, hapus. Di Next.js itu datang dari
 * `next/headers`; di Express nanti dari `req`/`res`. Selama service memanggil `next/headers`
 * langsung, service tidak bisa dipakai proses lain — jadi operasi itu diabstraksi di sini dulu,
 * **tanpa mengubah perilaku** untuk pemanggil yang sudah ada.
 *
 * Aturan: file ini tidak boleh mengimpor `next/*`. Implementasi Next ada di
 * `next-session-cookie-jar.ts`.
 */

export type SessionCookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

export interface SessionCookieJar {
  get(name: string): string | undefined;
  set(name: string, value: string, options: SessionCookieOptions): void;
  delete(name: string): void;
}

/**
 * Jar di memori — dipakai di test dan sebagai bukti bahwa service benar-benar tidak lagi
 * bergantung pada `next/headers`. Di produksi Express nanti, jar ditulis di atas `req.cookies`
 * + `res.cookie()`.
 */
export function createMemoryCookieJar(initial: Record<string, string> = {}): SessionCookieJar & {
  snapshot(): Record<string, string>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: (name) => store.get(name),
    set: (name, value) => {
      store.set(name, value);
    },
    delete: (name) => {
      store.delete(name);
    },
    snapshot: () => Object.fromEntries(store.entries()),
  };
}
