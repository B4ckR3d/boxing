import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (s: string) => s, lang: "id" }), LanguageSwitcher: () => null }));
vi.mock("@/lib/theme/ThemeContext", () => ({ ThemeToggle: () => null }));
import Login from "@/app/admin/login/page";
it("provides associated labels, bounded autocomplete inputs and accessible password visibility", () => {
  const html = renderToStaticMarkup(React.createElement(Login));
  expect(html).toContain('for="email"');
  expect(html).toContain('for="password"');
  expect(html).toContain('autoComplete="username"');
  expect(html).toContain('autoComplete="current-password"');
  expect(html).toContain('maxLength="1024"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).toContain('aria-busy="false"');
});
