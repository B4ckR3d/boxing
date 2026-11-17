import "server-only";
import { cookies } from "next/headers";
import type { SessionCookieJar, SessionCookieOptions } from "@/lib/auth/session-cookie-jar";

/**
 * Implementasi `SessionCookieJar` di atas `next/headers`.
 *
 * Ini satu-satunya tempat di jalur auth yang boleh menyentuh `next/headers`. Express nanti
 * menyediakan implementasi setara di atas `req`/`res`, dan `auth.service` tidak perlu berubah.
 */
export async function nextSessionCookieJar(): Promise<SessionCookieJar> {
  const store = await cookies();
  return {
    get: (name) => store.get(name)?.value,
    set: (name: string, value: string, options: SessionCookieOptions) => {
      store.set(name, value, options);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  };
}
