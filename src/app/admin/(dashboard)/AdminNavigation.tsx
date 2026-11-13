"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export interface AdminNavItem { href: string; label: string }

export default function AdminNavigation({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="p-3">
      <button type="button" aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen(!open)} className="md:hidden flex min-h-11 w-full items-center gap-2 border border-subtle px-3 text-sm focus-visible:outline-2 focus-visible:outline-fight-red">
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />} Menu administrasi
      </button>
      <nav id="admin-navigation" aria-label="Navigasi administrasi" className={`${open ? "block" : "hidden"} md:block mt-2 md:mt-0 space-y-1 font-mono-data text-xs font-semibold`}>
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={`flex min-h-11 items-center border-l-2 px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-fight-red ${active ? "border-fight-red bg-fight-red/10 text-ink" : "border-transparent text-ink-muted hover:bg-surface-elevated hover:text-ink"}`}>{item.label}</Link>;
        })}
      </nav>
    </div>
  );
}
