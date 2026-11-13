import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), settings: vi.fn(), config: { AUTH_ENFORCE_MFA: true } }));
vi.mock("@/server/services/auth.service", () => ({ getSession: mocks.session }));
vi.mock("@/server/services/settings.service", () => ({ getSettings: mocks.settings }));
vi.mock("@/lib/env", () => ({ env: () => mocks.config }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, usePathname: () => "/admin/ticketing" }));
vi.mock("@/components/admin/AdminLogoutButton", () => ({ AdminLogoutButton: () => null }));
vi.mock("@/lib/theme/ThemeContext", () => ({ ThemeToggle: () => null }));
import Layout from "@/app/admin/(dashboard)/layout";
const session = (permissions: string[] = ["admin.access"], extra = {}) => ({ name: "Admin", email: "a@example.com", roles: [], permissions: new Set(permissions), mfaEnabled: false, mfaRequired: false, mfaVerified: false, ...extra });
beforeEach(() => { mocks.config.AUTH_ENFORCE_MFA = true; mocks.settings.mockResolvedValue({ "branding.general": { abbreviation: "TFN", suffix: "X" } }); });
it("rejects a session without admin.access before loading settings", async () => {
  mocks.settings.mockClear(); mocks.session.mockResolvedValue(session([]));
  await expect(Layout({ children: null })).rejects.toThrow("REDIRECT:/admin/login");
  expect(mocks.settings).not.toHaveBeenCalled();
});
it("rejects unverified enrolled MFA sessions", async () => {
  mocks.session.mockResolvedValue(session(undefined, { mfaEnabled: true }));
  await expect(Layout({ children: null })).rejects.toThrow("REDIRECT:/admin/login");
});
it("rejects unenrolled role-required MFA sessions when enforcement is enabled", async () => {
  mocks.session.mockResolvedValue(session(undefined, { mfaRequired: true }));
  await expect(Layout({ children: null })).rejects.toThrow("REDIRECT:/admin/login");
});
it("does not hide a ticketing-only operator from ticketing navigation", async () => {
  mocks.session.mockResolvedValue(session(["admin.access", "ticketing.confirm"]));
  const html = renderToStaticMarkup(await Layout({ children: React.createElement("p", null, "Content") }));
  expect(html).toContain('href="/admin/ticketing"');
  expect(html).toContain('aria-current="page"');
});
it("hides ticketing from sessions without ticketing permissions", async () => {
  mocks.session.mockResolvedValue(session());
  const html = renderToStaticMarkup(await Layout({ children: null }));
  expect(html).not.toContain('href="/admin/ticketing"');
});
