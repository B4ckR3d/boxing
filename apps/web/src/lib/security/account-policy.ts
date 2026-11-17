import { z } from "zod";

type Variables = Record<string, string | undefined>;
const passwordSchema = z.string().min(12, "Password must have at least 12 characters");

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

export function getBootstrapAccount(e: Variables) {
  return {
    email: z.string().trim().toLowerCase().email().parse(e.BOOTSTRAP_ADMIN_EMAIL),
    name: z.string().trim().min(2).max(120).parse(e.BOOTSTRAP_ADMIN_NAME),
    password: passwordSchema.parse(e.BOOTSTRAP_ADMIN_PASSWORD),
  };
}
