import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/services/auth.service";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { ThemeToggle } from "@/lib/theme/ThemeContext";
import { getSettings } from "@/server/services/settings.service";
import type { PermissionKey } from "@/lib/permissions/catalog";
import AdminNavigation from "./AdminNavigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  Swords,
  Award,
  CalendarDays,
  Sliders,
  ClipboardList,
  UserCog,
  ShieldCheck,
  Settings,
} from "lucide-react";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Redirect unauthenticated visitors to login
  if (!session) {
    redirect("/admin/login");
  }

  const can = (permission: PermissionKey) =>
    session.roles.includes("super_admin") || session.permissions.has(permission);

  if (!can("admin.access")) redirect("/admin/login?error=forbidden");
  if ((session.mfaEnabled || session.mfaRequired) && !session.mfaVerified) {
    redirect("/admin/login?error=mfa_required");
  }

  const settings = await getSettings();
  const brand = settings["branding.general"];

  // Navigation Items — gated by the session's effective permissions (Indonesian Primary)
  const navItems = [
    { label: "Ringkasan", href: "/admin", icon: LayoutDashboard },
    { label: "Daftar Petarung", href: "/admin/fighters", icon: Users },
    { label: "Peringkat Resmi", href: "/admin/rankings", icon: Trophy },
    { label: "Turnamen Grand Prix", href: "/admin/grand-prix", icon: Swords },
    { label: "Sabuk Kejuaraan", href: "/admin/belts", icon: Award },
    { label: "Jadwal Event", href: "/admin/events", icon: CalendarDays },
    { label: "Hero Banner", href: "/admin/hero-slides", icon: Sliders },
    ...(can("ticketing.read") || can("ticketing.manage") || can("ticketing.confirm")
      ? [{ label: "Tiket & Pembayaran", href: "/admin/ticketing", icon: ClipboardList }]
      : []),
    ...(can("users.manage") || can("roles.manage")
      ? [
        { label: "Pengguna & Hak Akses", href: "/admin/users", icon: UserCog },
        {
          label: "Peran & Izin",
          href: "/admin/roles",
          icon: ShieldCheck,
        },
      ]
      : []),
    ...(can("audit.read")
      ? [{ label: "Log Audit Sistem", href: "/admin/audit-logs", icon: ClipboardList }]
      : []),
    ...(can("settings.manage")
      ? [
        {
          label: "Pengaturan Sistem",
          href: "/admin/settings",
          icon: Settings,
        },
      ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 md:sticky md:top-0 md:h-screen md:overflow-y-auto bg-charcoal border-r border-subtle flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-subtle flex items-center justify-between">
            <Link href="/" className="flex items-center tracking-tighter">
              <span className="font-display italic text-2xl text-ink font-black">
                {brand.abbreviation}
              </span>
              <span className="font-display italic text-xl text-fight-red font-black ml-0.5">
                {brand.suffix}
              </span>
              <span className="ml-1.5 font-mono-data text-[9px] bg-fight-red text-ink font-bold px-1.5 py-0.5 uppercase tracking-wider">
                CMS
              </span>
            </Link>

            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <span className="font-mono-data text-[9px] text-ink-muted border border-subtle px-1.5 py-0.5 uppercase font-bold">
                PORTAL
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <AdminNavigation items={navItems.map(({ href, label }) => ({ href, label }))} />
        </div>

        {/* User Session Footer & Logout */}
        <div className="p-4 border-t border-subtle bg-canvas-deep">
          <div className="mb-3">
            <p className="font-display text-sm text-ink truncate font-bold">
              {session.name}
            </p>
            <p className="font-mono-data text-[10px] text-ink-muted truncate">
              {session.email}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {session.roles.map((r) => (
                <span
                  key={r}
                  className="bg-surface-elevated text-fight-red font-mono-data text-[9px] font-bold px-1.5 py-0.5 uppercase"
                >
                  {r.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-subtle">
            <Link
              href="/"
              className="font-mono-data text-[10px] text-ink-muted hover:text-ink transition-colors"
            >
              Public Site →
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main id="admin-main" className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6 lg:p-10 bg-canvas">
        {children}
      </main>
    </div>
  );
}
