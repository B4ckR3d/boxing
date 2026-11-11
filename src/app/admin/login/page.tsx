"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage, LanguageSwitcher } from "@/lib/i18n/LanguageContext";
import { ThemeToggle } from "@/lib/theme/ThemeContext";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const { t, lang } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText =
          lang === "id"
            ? "Autentikasi gagal. Periksa kembali email dan kata sandi."
            : data.error || "Authentication failed";
        setErrorMsg(errorText);
        toast.error(errorText);
        setIsLoading(false);
        return;
      }

      toast.success(
        lang === "id"
          ? "Autentikasi berhasil! Masuk ke CMS Control Room..."
          : "Authentication successful! Entering CMS Control Room..."
      );
      router.push("/admin");
      router.refresh();
    } catch {
      const netError =
        lang === "id"
          ? "Koneksi jaringan bermasalah. Periksa koneksi server."
          : "Network connection error. Please verify server status.";
      setErrorMsg(netError);
      toast.error(netError);
      setIsLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Demo-Ringside-2026!");
    setErrorMsg(null);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-canvas p-4 relative select-none transition-colors"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, color-mix(in srgb, var(--overlay-scrim) 96%, var(--canvas)), color-mix(in srgb, var(--overlay-scrim) 99%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-md bg-charcoal border-2 border-subtle shadow-2xl p-8 relative">
        {/* Top Tag & Slanted TFN Logo */}
        <div className="flex items-center justify-between mb-6 border-b border-subtle pb-4">
          <Link href="/" className="flex items-center tracking-tighter">
            <span className="font-display italic text-3xl text-ink font-black">
              TFN
            </span>
            <span className="font-display italic text-2xl text-fight-red font-black ml-0.5">
              ·X
            </span>
            <span className="ml-2 font-mono-data text-[10px] bg-fight-red text-ink font-bold px-1.5 py-0.5 uppercase tracking-wider">
              CMS
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl text-ink uppercase font-black tracking-tight">
          {t("adminPortalTitle")}
        </h1>
        <p className="font-mono-data text-xs text-ink-muted mt-1">
          {t("adminPortalSub")}
        </p>

        {errorMsg && (
          <div className="mt-4 p-3 bg-fight-red/10 border border-fight-red flex items-center gap-2 text-ink font-mono-data text-xs">
            <AlertCircle className="w-4 h-4 text-fight-red shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block font-mono-data text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
              {t("adminEmailLabel")}
            </label>
            <input
              id="email"
              type="email"
              placeholder="admin@boxing.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-canvas border border-subtle focus:border-fight-red px-3.5 py-2.5 text-ink font-mono-data text-xs outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono-data text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
              {t("adminPasswordLabel")}
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-canvas border border-subtle focus:border-fight-red px-3.5 py-2.5 text-ink font-mono-data text-xs outline-none transition-colors"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="crimson"
              size="lg"
              className="w-full font-bold tracking-wider py-3 text-sm shadow-md"
              disabled={isLoading}
            >
              {isLoading
                ? (lang === "id" ? "MEMVERIFIKASI..." : "AUTHENTICATING...")
                : t("adminBtnLogin")}
            </Button>
          </div>
        </form>

        {/* Quick Demo Accounts Helper */}
        <div className="mt-8 pt-6 border-t border-subtle">
          <p className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider mb-2 font-bold flex items-center justify-between">
            <span>⚡ {t("adminDemoTitle")}</span>
            <span className="text-fight-red">Demo-Ringside-2026!</span>
          </p>

          <div className="grid grid-cols-2 gap-2 font-mono-data text-xs">
            <button
              type="button"
              onClick={() => fillDemoAccount("superadmin@boxing.local")}
              className="p-2 bg-canvas border border-subtle hover:border-fight-red text-ink hover:text-fight-red text-left transition-colors cursor-pointer"
            >
              <span className="block font-bold text-[11px]">Super Admin</span>
              <span className="text-[9px] text-ink-subtle truncate block">superadmin@boxing.local</span>
            </button>

            <button
              type="button"
              onClick={() => fillDemoAccount("admin@boxing.local")}
              className="p-2 bg-canvas border border-subtle hover:border-fight-red text-ink hover:text-fight-red text-left transition-colors cursor-pointer"
            >
              <span className="block font-bold text-[11px]">Platform Admin</span>
              <span className="text-[9px] text-ink-subtle truncate block">admin@boxing.local</span>
            </button>

            <button
              type="button"
              onClick={() => fillDemoAccount("rankings@boxing.local")}
              className="p-2 bg-canvas border border-subtle hover:border-fight-red text-ink hover:text-fight-red text-left transition-colors cursor-pointer"
            >
              <span className="block font-bold text-[11px]">{lang === "id" ? "Manajer Peringkat" : "Ranking Manager"}</span>
              <span className="text-[9px] text-ink-subtle truncate block">rankings@boxing.local</span>
            </button>

            <button
              type="button"
              onClick={() => fillDemoAccount("tournaments@boxing.local")}
              className="p-2 bg-canvas border border-subtle hover:border-fight-red text-ink hover:text-fight-red text-left transition-colors cursor-pointer"
            >
              <span className="block font-bold text-[11px]">{lang === "id" ? "Manajer Turnamen" : "Tournament Mgr"}</span>
              <span className="text-[9px] text-ink-subtle truncate block">tournaments@boxing.local</span>
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="font-mono-data text-xs text-ink-muted hover:text-ink transition-colors"
          >
            {t("adminBackToPublic")}
          </Link>
        </div>
      </div>
    </div>
  );
}
