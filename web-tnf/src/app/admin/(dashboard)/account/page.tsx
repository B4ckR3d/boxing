import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/services/auth.service";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";

/**
 * Halaman akun sendiri — hanya butuh sesi sah, tanpa permission khusus.
 *
 * Setiap user berhak mengganti password-nya sendiri, jadi halaman ini TIDAK memakai
 * `requirePermission`. Semua aturan (verifikasi password lama, policy password baru, pencabutan
 * sesi lain) dijalankan di `apps/api`.
 */
export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="space-y-6 text-ink select-none">
      <div className="pb-4 border-b border-subtle">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
            AKUN SAYA
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
          KEAMANAN AKUN
        </h1>
        <p className="font-mono-data text-xs text-ink-muted mt-1">
          Ganti kata sandi Anda sendiri. Sesi di perangkat lain akan diakhiri otomatis.
        </p>
      </div>

      <div className="bg-charcoal border border-subtle p-5 space-y-1">
        <p className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider">
          Identitas login
        </p>
        <p className="font-mono-data text-sm text-ink">
          <span className="font-bold">@{session.username}</span>
          <span className="text-ink-muted"> · {session.email}</span>
        </p>
        <p className="font-mono-data text-[10px] text-ink-subtle">
          Anda bisa masuk memakai username atau email di atas.
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
