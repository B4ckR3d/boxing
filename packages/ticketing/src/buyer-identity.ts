/**
 * Buyer identity normalisation for the per-category purchase cap.
 *
 * Orders are created by guests, so there is no account to key on: the cap has to reason about
 * `customerEmail` + `customerPhone` as typed. People type "+62 812-3456-7890", "0812 3456 7890"
 * and "628123456789" for the *same* number, and "Rina@Example.com" vs "rina@example.com" for the
 * same inbox — all of those must collapse to one identity or the cap is trivially bypassed.
 */

/** Lowercase + trim; emails are case-insensitive in practice. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Canonical Indonesian mobile number: digits only, national prefix `0…`.
 *
 *   +62 812-3456-7890 → 081234567890
 *   62812 3456 7890   → 081234567890
 *   812 3456 7890     → 081234567890
 *   0812 3456 7890    → 081234567890
 *
 * Anything that isn't a recognisable Indonesian form is returned as bare digits, which still
 * compares correctly as long as both sides went through this function.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.startsWith("62")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0")) return digits;
  if (digits.startsWith("8")) return `0${digits}`;
  return digits;
}

/**
 * True when two typed numbers describe the same line.
 * Empty values never match each other (an order without a usable phone must not swallow the next one).
 */
export function samePhone(a: string, b: string): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return left.length >= 9 && left === right;
}

/** Same inbox, ignoring case / surrounding spaces. */
export function sameEmail(a: string, b: string): boolean {
  const left = normalizeEmail(a);
  return left.length > 0 && left === normalizeEmail(b);
}
