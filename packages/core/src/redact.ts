/**
 * Redacts secrets before anything is written to audit logs or server logs.
 * Rule: keys matching the pattern are replaced with "[REDACTED]" recursively.
 */
const SENSITIVE_KEY = /pass(word)?|secret|token|cookie|session|authorization|mfa|otp|totp|code|hash|apikey|api_key|accesskey|privatekey/i;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function redact(value: unknown, depth = 0): JsonValue {
  if (depth > 6) return "[TRUNCATED]";
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    // Prisma Decimal & similar
    if ("toJSON" in value && typeof (value as { toJSON: unknown }).toJSON === "function") {
      return redact((value as { toJSON: () => unknown }).toJSON(), depth + 1);
    }
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Shallow diff of two objects (only changed keys), redacted. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>): JsonValue {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(redact(a)) !== JSON.stringify(redact(b))) changes[key] = { from: a, to: b };
  }
  return redact(changes);
}

