import "server-only";
import { env } from "@/lib/env";
import {
  sha256Hex,
  randomToken,
  safeEqual,
  hmacSha256 as hmacSha256WithSecret,
  encryptSecret as encryptWithKey,
  decryptSecret as decryptWithKey,
} from "@tfn/auth/crypto";

/**
 * Binding web untuk `@tfn/auth/crypto` (Langkah E2).
 *
 * Primitifnya murni di paket; di sini hanya kunci dari `env()` yang disuntikkan, supaya pemanggil
 * lama (`hmacSha256(v)`, `encryptSecret(p)`, `decryptSecret(p)`) tetap valid tanpa perubahan.
 */
export { sha256Hex, randomToken, safeEqual };

export function hmacSha256(value: string, secret: string = env().AUTH_SECRET): string {
  return hmacSha256WithSecret(value, secret);
}

export function encryptSecret(plain: string): string {
  return encryptWithKey(plain, env().ENCRYPTION_KEY);
}

export function decryptSecret(payload: string): string {
  return decryptWithKey(payload, env().ENCRYPTION_KEY);
}
