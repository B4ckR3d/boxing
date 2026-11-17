"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, Ticket, X } from "lucide-react";
import { useLanguage, LanguageSwitcher } from "@/lib/i18n/LanguageContext";
import { ThemeToggle } from "@/lib/theme/ThemeContext";

export function Navbar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { t, lang } = useLanguage();
  const navLinks = [
    { label: t("navHome"), href: "/" },
    { label: t("navEvents"), href: "/events" },
    { label: t("navAthletes"), href: "/fighters" },
    { label: t("navRankings"), href: "/rankings" },
    { label: t("navNews"), href: "/news" },
    { label: t("navGrandPrix"), href: "/grand-prix" },
    { label: t("navBelts"), href: "/belts" },
    { label: t("navFightHistory"), href: "/fights" },
  ];
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => {
    if (!isMobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-subtle bg-charcoal text-ink">
      <a href="#main-content" className="tfn-skip-link">{lang === "id" ? "Lewati ke konten" : "Skip to content"}</a>
      <div className="border-b border-subtle bg-canvas">
        <div className="mx-auto flex min-h-11 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <p className="font-mono-data text-[10px] uppercase tracking-[0.12em] text-ink-muted sm:text-xs">
            <span className="text-fight-red">TEMANGGUNG</span><span className="hidden sm:inline"> · CENTRAL JAVA</span> / FIGHT NIGHT
          </p>
          <div className="flex shrink-0 items-center gap-3"><LanguageSwitcher /><ThemeToggle /></div>
        </div>
      </div>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="TFN — Temanggung Fight Night" onClick={() => setIsMobileOpen(false)} className="flex shrink-0 items-center gap-3">
          <span className="font-display text-4xl font-black italic tracking-tighter">TFN<span className="text-fight-red">.</span></span>
          <span className="hidden border-l border-subtle pl-3 font-display text-[10px] leading-relaxed tracking-[0.12em] 2xl:block">TEMANGGUNG<br />FIGHT NIGHT</span>
        </Link>
        <nav aria-label={lang === "id" ? "Navigasi utama" : "Main navigation"} className="hidden items-center gap-4 xl:flex">
          {navLinks.map((link) => <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? "page" : undefined} className={`inline-flex min-h-11 items-center border-b-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${isActive(link.href) ? "border-fight-red text-fight-red" : "border-transparent hover:text-fight-red"}`}>{link.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/tickets" onClick={() => setIsMobileOpen(false)} className="tfn-ticket-link inline-flex min-h-11 items-center justify-center gap-2 bg-fight-red px-4 text-xs font-bold uppercase tracking-wider text-white hover:bg-fight-red-hover sm:px-5"><Ticket className="h-4 w-4" aria-hidden="true" />{lang === "id" ? "Tiket" : "Tickets"}<ArrowUpRight className="hidden h-4 w-4 sm:block" aria-hidden="true" /></Link>
          <button ref={menuButton} type="button" aria-expanded={isMobileOpen} aria-controls="public-mobile-nav" aria-label={lang === "id" ? "Menu navigasi" : "Navigation menu"} onClick={() => setIsMobileOpen(!isMobileOpen)} className="flex h-11 w-11 items-center justify-center border border-subtle xl:hidden">{isMobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
        </div>
      </div>
      {isMobileOpen && <nav id="public-mobile-nav" aria-label={lang === "id" ? "Navigasi seluler" : "Mobile navigation"} className="max-h-[calc(100dvh-124px)] overflow-y-auto border-t border-subtle bg-canvas px-4 pb-5 sm:px-6 xl:hidden">
        {navLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setIsMobileOpen(false)} aria-current={isActive(link.href) ? "page" : undefined} className={`flex min-h-12 items-center justify-between border-b border-subtle font-display text-lg ${isActive(link.href) ? "text-fight-red" : "text-ink"}`}>{link.label}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>)}
      </nav>}
    </header>
  );
}
