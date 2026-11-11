/**
 * Context-aware sanitization helpers (pure, unit-tested).
 * React escapes text by default; we additionally strip markup from free text so that stored data
 * is safe for any consumer (emails, exports, JSON API clients). HTML is never rendered from user input.
 */

/** Strips HTML tags and control characters, normalizes whitespace on single-line fields. */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same as sanitizeText but preserves line breaks (for bios / descriptions). */
export function sanitizeMultiline(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Accepts only internal paths ("/fighters/x", "#rankings") or absolute http(s) URLs.
 * Rejects javascript:, data:, vbscript:, protocol-relative "//evil.com", and backslash tricks.
 */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value || value.length > 500) return false;
  if (/[\u0000-\u001F\s\\]/.test(value)) return false;
  if (value.startsWith("#")) return /^#[A-Za-z0-9\-_]+$/.test(value);
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Sanitizes an uploaded filename for display only (storage keys are always random). */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 200) || "file";
}

