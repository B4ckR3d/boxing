"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage, LanguageSwitcher } from "@/lib/i18n/LanguageContext";
import { ThemeToggle } from "@/lib/theme/ThemeContext";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submitting = useRef(false);
  const router = useRouter();
  const { t, lang } = useLanguage();
  const inputClass = "w-full bg-canvas border border-subtle focus:border-fight-red focus-visible:outline-2 focus-visible:outline-fight-red px-3.5 py-2.5 text-ink font-mono-data text-sm disabled:opacity-60";
  const labelClass = "block font-mono-data text-xs font-bold text-ink-muted uppercase tracking-wider mb-1";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setIsLoading(true);
    setErrorMsg(null);
    let navigating = false;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(requiresMfa ? { totpCode } : {}) }),
      });
      const data = await res.json();
      if (data.requiresMfa) {
        setRequiresMfa(true);
        setTotpCode("");
        setErrorMsg(data.error || (lang === "id" ? "Masukkan kode dari aplikasi autentikator." : "Enter your authenticator code."));
        return;
      }
      if (!res.ok || data.success !== true) {
        const message = data.error || (lang === "id" ? "Autentikasi gagal. Periksa email dan kata sandi." : "Authentication failed. Check your credentials.");
        setErrorMsg(message);
        toast.error(message);
        return;
      }
      navigating = true;
      setPassword("");
      setTotpCode("");
      toast.success(lang === "id" ? "Autentikasi berhasil. Membuka CMS..." : "Authentication successful. Opening CMS...");
      router.replace("/admin");
      router.refresh();
    } catch {
      setErrorMsg(lang === "id" ? "Tidak dapat terhubung ke server. Silakan coba lagi." : "Cannot connect to the server. Please try again.");
    } finally {
      if (!navigating) {
        submitting.current = false;
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4 transition-colors" style={{ backgroundImage: "linear-gradient(to bottom, color-mix(in srgb, var(--overlay-scrim) 96%, var(--canvas)), color-mix(in srgb, var(--overlay-scrim) 99%, var(--canvas))), url('/images/hero/boxing-ring-arena.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="w-full max-w-md bg-charcoal border border-subtle shadow-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6 border-b border-subtle pb-4">
          <Link href="/" aria-label="TFN — beranda" className="flex items-center tracking-tighter">
            <span className="font-display italic text-3xl text-ink font-black">TFN</span>
            <span className="font-display italic text-2xl text-fight-red font-black ml-0.5">·X</span>
            <span className="ml-2 font-mono-data text-[10px] bg-fight-red text-ink font-bold px-1.5 py-0.5">CMS</span>
          </Link>
          <div className="flex items-center gap-2"><LanguageSwitcher /><ThemeToggle /></div>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink uppercase font-black tracking-tight">{t("adminPortalTitle")}</h1>
        <p className="font-mono-data text-xs text-ink-muted mt-1">{t("adminPortalSub")}</p>
        {errorMsg && <div id="login-error" role="alert" className="mt-4 p-3 bg-fight-red/10 border border-fight-red flex items-start gap-2 text-ink text-sm"><AlertCircle aria-hidden="true" className="w-4 h-4 text-fight-red shrink-0 mt-0.5" /><span>{errorMsg}</span></div>}
        <form onSubmit={handleLogin} aria-busy={isLoading} aria-describedby={errorMsg ? "login-error" : undefined} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>{t("adminEmailLabel")}</label>
            <input id="email" name="email" type="email" autoComplete="username" maxLength={191} value={email} onChange={(e) => { setEmail(e.target.value); setRequiresMfa(false); setTotpCode(""); }} required disabled={isLoading} className={inputClass} />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>{t("adminPasswordLabel")}</label>
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" maxLength={1024} value={password} onChange={(e) => { setPassword(e.target.value); setRequiresMfa(false); setTotpCode(""); }} required disabled={isLoading} className={inputClass} />
            <button type="button" aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="mt-1 inline-flex min-h-10 items-center gap-2 text-xs text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-fight-red">
              {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              {lang === "id" ? (showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi") : (showPassword ? "Hide password" : "Show password")}
            </button>
          </div>
          {requiresMfa && <div>
            <label htmlFor="totpCode" className={labelClass}>{lang === "id" ? "Kode autentikator (6 digit)" : "Authenticator code (6 digits)"}</label>
            <input id="totpCode" name="totpCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))} required autoFocus disabled={isLoading} className={inputClass} />
          </div>}
          <Button type="submit" variant="crimson" size="lg" className="w-full font-bold tracking-wider py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fight-red" disabled={isLoading}>
            {isLoading && <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? (lang === "id" ? "MEMVERIFIKASI..." : "AUTHENTICATING...") : t("adminBtnLogin")}
          </Button>
        </form>
        <div className="mt-8 pt-4 border-t border-subtle text-center"><Link href="/" className="font-mono-data text-xs text-ink-muted hover:text-ink">{t("adminBackToPublic")}</Link></div>
      </div>
    </div>
  );
}
