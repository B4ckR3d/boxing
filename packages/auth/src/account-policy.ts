import { z } from "zod";
import { usernameSchema } from "./rbac.service";

type Variables = Record<string, string | undefined>;
const passwordSchema = z.string().min(12, "Password must have at least 12 characters");
const emailSchema = z.string().trim().toLowerCase().email();

export function getSeedPolicy(e: Variables) {
  const demo = e.SEED_DEMO === "true";
  const demoUsers = e.SEED_DEMO_USERS === "true";
  if (e.NODE_ENV === "production" && (demo || demoUsers)) {
    throw new Error("Demo data and accounts are forbidden in production");
  }
  if (demoUsers && !e.DEMO_USER_PASSWORD) throw new Error("DEMO_USER_PASSWORD is required; no default password exists");
  const password = demoUsers ? passwordSchema.parse(e.DEMO_USER_PASSWORD) : undefined;
  return { demo, demoUsers, password };
}

/**
 * Turunkan username dari local-part email agar bootstrap lama (yang hanya punya email) tetap jalan
 * setelah `User.username` menjadi wajib. Karakter yang tidak sah untuk username (mis. `+`) diganti
 * `-`, lalu pemisah di ujung dibuang.
 */
function deriveUsernameFromEmail(email: string): string {
  return (email.split("@")[0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
}

export function getBootstrapAccount(e: Variables) {
  const email = emailSchema.parse(e.BOOTSTRAP_ADMIN_EMAIL);
  const password = passwordSchema.parse(e.BOOTSTRAP_ADMIN_PASSWORD);
  const name = z.string().trim().min(2).max(120).parse(e.BOOTSTRAP_ADMIN_NAME);

  const explicit = (e.BOOTSTRAP_ADMIN_USERNAME ?? "").trim();
  const candidate = explicit.length > 0 ? explicit : deriveUsernameFromEmail(email);

  // Dilempar lebih awal dengan pesan yang bisa ditindaklanjuti: tanpa ini `usernameSchema` akan
  // gagal dengan pesan generik ("at least 3 characters") yang tidak menjelaskan cara memperbaikinya.
  if (candidate.length < 3) {
    throw new Error(
      "BOOTSTRAP_ADMIN_USERNAME is required: cannot derive a valid username (min 3 chars) from BOOTSTRAP_ADMIN_EMAIL",
    );
  }

  return {
    username: usernameSchema.parse(candidate),
    email,
    name,
    password,
  };
}
