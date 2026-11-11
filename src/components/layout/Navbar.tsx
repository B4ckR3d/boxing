"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X, Search, ChevronRight } from "lucide-react";
import { useLanguage, LanguageSwitcher } from "@/lib/i18n/LanguageContext";
import { ThemeToggle } from "@/lib/theme/ThemeContext";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();
  const { t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: t("navHome"), href: "/" },
    { label: t("navEvents"), href: "/events" },
    { label: t("navRankings"), href: "/rankings" },
    { label: t("navNews"), href: "/news" },
    { label: t("navAthletes"), href: "/fighters" },
    { label: t("navGrandPrix"), href: "/grand-prix" },
    { label: t("navBelts"), href: "/belts" },
    { label: t("navFightHistory"), href: "/fights" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-200">
      {/* 1. Top Announcement, Language & Theme Bar */}
      <div className="bg-canvas border-b border-subtle text-xs py-1.5 px-4 sm:px-6 lg:px-8 text-ink-muted select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Live Ticker */}
          <div className="flex items-center gap-2.5 overflow-hidden text-[11px] sm:text-xs">
            <span className="inline-flex items-center gap-1.5 bg-fight-red text-ink font-bold px-2 py-0.5 uppercase tracking-wider text-[10px] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-fight-red animate-pulse" />
              {t("liveTickerBadge")}
            </span>
            <span className="truncate text-ink-muted font-medium">
              {t("liveTickerText")}
            </span>
          </div>

          {/* Controls: Language Switcher + Theme Switcher + Socials */}
          <div className="flex items-center gap-3 text-[11px] shrink-0">
            {/* Language Switcher: ID (Utama) | EN (Kedua) */}
            <LanguageSwitcher />

            {/* Dark / Light Mode Switch */}
            <ThemeToggle />

            {/* Social Icons */}
            <div className="hidden lg:flex items-center gap-2 text-ink pl-2 border-l border-subtle">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-5 h-5 rounded-full bg-surface-elevated hover:bg-fight-red flex items-center justify-center transition-colors text-[10px]"
                aria-label="Facebook"
              >
                f
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="w-5 h-5 rounded-full bg-surface-elevated hover:bg-fight-red flex items-center justify-center transition-colors text-[10px]"
                aria-label="X Twitter"
              >
                𝕏
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-5 h-5 rounded-full bg-surface-elevated hover:bg-fight-red flex items-center justify-center transition-colors text-[10px]"
                aria-label="Instagram"
              >
                o
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Header Bar (TFN Brand Logo & Nav) */}
      <div
        className={`bg-charcoal transition-all duration-200 border-b ${
          isScrolled ? "py-2.5 shadow-md border-subtle" : "py-3.5 border-subtle"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* TFN (Temanggung Fight Night) Brand Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex items-center tracking-tighter select-none">
                <span className="font-display italic text-3xl sm:text-4xl text-ink font-black tracking-normal">
                  TFN
                </span>
                <span className="font-display italic text-2xl sm:text-3xl text-fight-red font-black ml-0.5">
                  ·X
                </span>
              </div>
              <div className="hidden sm:block border-l border-subtle pl-2 ml-1">
                <span className="font-display text-[10px] text-ink uppercase tracking-widest block leading-tight font-black">
                  Temanggung Fight Night
                </span>
                <span className="font-display text-[9px] text-fight-red font-bold tracking-widest block leading-tight uppercase">
                  Kejuaraan Tinju Profesional
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-bold uppercase tracking-wider transition-colors py-1 ${
                    isActive(link.href)
                      ? "text-fight-red border-b-2 border-fight-red"
                      : "text-ink hover:text-fight-red"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right Side Actions: Search + BELI TIKET Red Button */}
            <div className="hidden lg:flex items-center gap-4">
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 text-ink-muted hover:text-fight-red transition-colors cursor-pointer"
                aria-label="Search site"
              >
                <Search className="w-5 h-5" />
              </button>

              <Link href="/events">
                <Button variant="crimson" size="md" className="font-bold tracking-wider">
                  {t("navBuyTicket")}
                </Button>
              </Link>
            </div>

            {/* Mobile Actions */}
            <div className="flex xl:hidden items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 text-ink"
                aria-label="Search site"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="p-2 text-ink border border-subtle"
                aria-label="Toggle navigation menu"
              >
                {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar Drawer */}
        {isSearchOpen && (
          <div className="border-t border-subtle bg-neutral-50 px-4 py-3 sm:px-6">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <Search className="w-4 h-4 text-ink-muted" />
              <input
                type="text"
                placeholder={t("navSearchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-ink focus:outline-none placeholder:text-ink-muted font-sans"
                autoFocus
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-xs uppercase font-bold text-ink-subtle hover:text-ink cursor-pointer"
              >
                ESC
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileOpen && (
        <div className="xl:hidden bg-canvas border-b-2 border-fight-red text-ink p-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-subtle mb-2">
            <span className="font-mono-data text-xs text-ink-muted">PILIH BAHASA:</span>
            <LanguageSwitcher />
          </div>

          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className={`font-display text-lg tracking-wider py-2 flex items-center justify-between border-b border-subtle ${
                  isActive(link.href) ? "text-fight-red" : "text-ink"
                }`}
              >
                <span>{link.label}</span>
                <ChevronRight className="w-4 h-4 text-ink-subtle" />
              </Link>
            ))}
            <div className="pt-4 flex flex-col gap-2">
              <Link href="/events" onClick={() => setIsMobileOpen(false)}>
                <Button variant="crimson" size="md" className="w-full">
                  {t("navBuyTicket")}
                </Button>
              </Link>
              <Link href="/rankings" onClick={() => setIsMobileOpen(false)}>
                <Button variant="outline" size="md" className="w-full">
                  {t("navViewRankings")}
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
