"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, LoaderCircle, Eye, EyeOff } from "lucide-react";
import { createUserAction } from "@/app/admin/(dashboard)/users/actions";

/**
 * Form pembuatan user (super admin / pemegang `users.manage`).
 *
 * Validasi bentuk sepenuhnya di `apps/api` lewat `createUserSchema` — form ini sengaja tidak
 * menduplikasi aturan. Yang ditampilkan di sini hanya bantuan (hint) supaya operator tidak
 * menebak-nebak, dan pesan error asli dari API ditampilkan apa adanya.
 *
 * Password tidak pernah disimpan di state setelah submit berhasil; form di-reset total.
 */

interface RoleOption {
  id: string;
  key: string;
  name: string;
  isSensitive: boolean;
}

interface CreateUserFormProps {
  roles: RoleOption[];
}

const inputClass =
  "w-full bg-canvas border border-subtle focus:border-fight-red focus-visible:outline-2 focus-visible:outline-fight-red px-3 py-2 text-ink font-mono-data text-sm disabled:opacity-60";
const labelClass =
  "block font-mono-data text-xs font-bold text-ink-muted uppercase tracking-wider mb-1";

export function CreateUserForm({ roles }: CreateUserFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const reset = () => {
    setUsername("");
    setName("");
    setEmail("");
    setPassword("");
    setRoleIds([]);
    setError(null);
    setShowPassword(false);
  };

  const toggleRole = (id: string) => {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createUserAction({ username, name, email, password, roleIds });
      if (!res.ok) {
        setError(res.error ?? "Failed to create user");
        toast.error(res.error ?? "Failed to create user");
        return;
      }

      toast.success(`User "${res.username}" created`);
      reset();
      setIsOpen(false);
      router.refresh();
    });
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 border border-fight-red text-fight-red hover:bg-fight-red hover:text-ink font-mono-data text-xs font-bold uppercase tracking-wider px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fight-red"
      >
        <UserPlus aria-hidden="true" className="w-4 h-4" />
        Tambah user baru
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={pending}
      className="bg-charcoal border border-subtle p-5 space-y-4"
    >
      <div className="flex items-center justify-between border-b border-subtle pb-3">
        <h2 className="font-display text-lg uppercase font-black flex items-center gap-2">
          <UserPlus aria-hidden="true" className="w-4 h-4 text-fight-red" />
          Tambah User Baru
        </h2>
        <button
          type="button"
          onClick={() => {
            reset();
            setIsOpen(false);
          }}
          disabled={pending}
          className="font-mono-data text-xs text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-fight-red disabled:opacity-60"
        >
          Batal
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-fight-red/10 border border-fight-red text-ink text-sm">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="new-username" className={labelClass}>
            Username
          </label>
          <input
            id="new-username"
            name="username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={64}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
            className={inputClass}
          />
          <p className="font-mono-data text-[10px] text-ink-subtle mt-1">
            3–64 karakter, huruf kecil/angka/titik/garis bawah/strip. Tanpa @.
          </p>
        </div>

        <div>
          <label htmlFor="new-name" className={labelClass}>
            Nama lengkap
          </label>
          <input
            id="new-name"
            name="name"
            type="text"
            autoComplete="off"
            maxLength={120}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="new-email" className={labelClass}>
            Email
          </label>
          <input
            id="new-email"
            name="email"
            type="email"
            autoComplete="off"
            maxLength={191}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="new-password" className={labelClass}>
            Password awal
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id="new-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              className={inputClass}
            />
            <button
              type="button"
              aria-controls="new-password"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              className="px-3 border border-subtle text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-fight-red"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Eye aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="font-mono-data text-[10px] text-ink-subtle mt-1">
            Minimal 12 karakter, wajib ada huruf besar, huruf kecil, angka, dan simbol.
          </p>
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Role (opsional)</legend>
        <div className="grid sm:grid-cols-2 gap-2 mt-1">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-2 border border-subtle bg-canvas-deep px-3 py-2 cursor-pointer hover:border-fight-red transition-colors"
            >
              <input
                type="checkbox"
                checked={roleIds.includes(role.id)}
                onChange={() => toggleRole(role.id)}
                disabled={pending}
                className="accent-fight-red"
              />
              <span className="font-mono-data text-xs text-ink">
                {role.name}
                {role.isSensitive && (
                  <span className="ml-1 text-[10px] text-fight-red font-bold uppercase">
                    sensitif
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        <p className="font-mono-data text-[10px] text-ink-subtle mt-1">
          Role sensitif tidak bisa diberikan saat pembuatan user (mencegah eskalasi hak akses).
          Buat user dulu, lalu ajukan role sensitif lewat alur four-eyes di daftar bawah.
        </p>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 bg-fight-red text-ink font-mono-data text-xs font-bold uppercase tracking-wider px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fight-red"
        >
          {pending && <LoaderCircle aria-hidden="true" className="w-4 h-4 animate-spin" />}
          {pending ? "Menyimpan..." : "Buat user"}
        </button>
      </div>
    </form>
  );
}
