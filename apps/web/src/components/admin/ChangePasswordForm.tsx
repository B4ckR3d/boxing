"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, LoaderCircle, Eye, EyeOff, AlertCircle } from "lucide-react";

/**
 * Form ganti password milik sendiri.
 *
 * Memanggil BFF `/api/auth/change-password` (bukan server action) karena API mengembalikan
 * `Set-Cookie` yang harus sampai ke browser — sama seperti alur login/logout.
 *
 * Setelah sukses form dikosongkan dan halaman di-refresh; sesi di perangkat lain sudah dicabut
 * oleh API, sesi yang sedang dipakai tetap hidup.
 */

const inputClass =
  "w-full bg-canvas border border-subtle focus:border-fight-red focus-visible:outline-2 focus-visible:outline-fight-red px-3 py-2 text-ink font-mono-data text-sm disabled:opacity-60";
const labelClass =
  "block font-mono-data text-xs font-bold text-ink-muted uppercase tracking-wider mb-1";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Cek cepat di klien supaya tidak membuang request; sumber kebenaran tetap API.
    if (newPassword !== confirmPassword) {
      setErrorMsg("Konfirmasi password tidak cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMsg("Password baru harus berbeda dari password sekarang.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success !== true) {
        const message =
          data?.error ||
          (res.status === 401
            ? "Sesi berakhir. Silakan masuk kembali."
            : "Gagal mengganti password. Silakan coba lagi.");
        setErrorMsg(message);
        toast.error(message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password berhasil diganti. Sesi lain sudah diakhiri.");
      router.refresh();
    } catch {
      setErrorMsg("Tidak dapat terhubung ke server. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isLoading}
      aria-describedby={errorMsg ? "change-password-error" : undefined}
      className="bg-charcoal border border-subtle p-5 space-y-4 max-w-xl"
    >
      <h2 className="font-display text-lg uppercase font-black flex items-center gap-2 border-b border-subtle pb-3">
        <KeyRound aria-hidden="true" className="w-4 h-4 text-fight-red" />
        Ganti Kata Sandi
      </h2>

      {errorMsg && (
        <div
          id="change-password-error"
          role="alert"
          className="p-3 bg-fight-red/10 border border-fight-red flex items-start gap-2 text-ink text-sm"
        >
          <AlertCircle aria-hidden="true" className="w-4 h-4 text-fight-red shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className={labelClass}>
          Password sekarang
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="current-password"
          required
          maxLength={1024}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={isLoading}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="newPassword" className={labelClass}>
          Password baru
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isLoading}
          className={inputClass}
        />
        <p className="font-mono-data text-[10px] text-ink-subtle mt-1">
          Minimal 12 karakter, wajib ada huruf besar, huruf kecil, angka, dan simbol.
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          Ulangi password baru
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          className={inputClass}
        />
      </div>

      <button
        type="button"
        aria-controls="currentPassword newPassword confirmPassword"
        aria-pressed={showPasswords}
        onClick={() => setShowPasswords((v) => !v)}
        className="inline-flex min-h-10 items-center gap-2 text-xs text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-fight-red"
      >
        {showPasswords ? (
          <EyeOff aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Eye aria-hidden="true" className="h-4 w-4" />
        )}
        {showPasswords ? "Sembunyikan password" : "Tampilkan password"}
      </button>

      <div className="flex justify-end pt-2 border-t border-subtle">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-fight-red text-ink font-mono-data text-xs font-bold uppercase tracking-wider px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fight-red"
        >
          {isLoading && <LoaderCircle aria-hidden="true" className="w-4 h-4 animate-spin" />}
          {isLoading ? "Menyimpan..." : "Simpan password baru"}
        </button>
      </div>
    </form>
  );
}
