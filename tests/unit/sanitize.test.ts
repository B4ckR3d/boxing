import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  sanitizeMultiline,
  isSafeHref,
  slugify,
  sanitizeFilename,
} from "@/lib/security/sanitize";

describe("Sanitization & Security Input Scrubbing", () => {
  it("strips HTML tags and normalizes whitespace in single-line text", () => {
    const raw = "  <script>alert('xss')</script> Marcus   <b>Iron</b> Vale  ";
    const cleaned = sanitizeText(raw);
    expect(cleaned).toBe("alert('xss') Marcus Iron Vale");
  });

  it("preserves legitimate line breaks while stripping tags in multiline bios", () => {
    const raw = "<p>Undefeated champion.</p>\n\n<script>bad()</script>\nFought 28 bouts.";
    const cleaned = sanitizeMultiline(raw);
    expect(cleaned).toContain("Undefeated champion.");
    expect(cleaned).toContain("Fought 28 bouts.");
    expect(cleaned).not.toContain("<script>");
  });

  it("validates safe relative and https Href links", () => {
    expect(isSafeHref("/fighters/marcus-vale")).toBe(true);
    expect(isSafeHref("#rankings")).toBe(true);
    expect(isSafeHref("https://boxing.example.com/tickets")).toBe(true);
  });

  it("strictly rejects dangerous schemes and open redirects", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html;base64,PHNjcmlwdD5...==")).toBe(false);
    expect(isSafeHref("//malicious-phishing.com/login")).toBe(false);
    expect(isSafeHref("vbscript:execute(1)")).toBe(false);
  });

  it("produces clean, SEO-friendly URL slugs", () => {
    expect(slugify("Marcus 'Iron' Vale Jr.")).toBe("marcus-iron-vale-jr");
    expect(slugify("WBC-X Heavyweight World Grand Prix 2026")).toBe(
      "wbc-x-heavyweight-world-grand-prix-2026"
    );
  });

  it("sanitizes file names preventing path traversal attacks", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("belt..image.png")).toBe("belt..image.png");
    expect(sanitizeFilename("foo/bar/fighter portrait.jpg")).toBe("fighter portrait.jpg");
  });
});

