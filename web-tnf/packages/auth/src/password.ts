import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

/**
 * Argon2id with OWASP-recommended parameters (m=19 MiB, t=2, p=1).
 * Algorithm: 2 = Argon2id (0 = Argon2d, 1 = Argon2i, 2 = Argon2id)
 */
const ARGON_OPTIONS = {
  algorithm: 2 as const,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON_OPTIONS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

/** A precomputed hash used to equalize timing when the user does not exist. */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(plain: string): Promise<void> {
  dummyHash ??= hashPassword("timing-equalizer-not-a-real-password");
  await verifyPassword(await dummyHash, plain);
}

export const passwordPolicy = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((v) => /[a-z]/.test(v), "Password must contain a lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Password must contain an uppercase letter")
  .refine((v) => /\d/.test(v), "Password must contain a number")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Password must contain a symbol");

