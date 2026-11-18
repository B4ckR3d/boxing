import "server-only";
import { cookies, headers } from "next/headers";
import type { RoleDetail, UserDetail, PendingRoleRequest } from "@tfn/auth/rbac-service";
import { apiFetch } from "./client";

/**
 * Klien BFF untuk endpoint RBAC di `apps/api` (Langkah F lanjutan).
 *
 * Sebelumnya halaman admin memanggil `@/server/services/rbac.service` — artinya otorisasi dan aturan
 * bisnis berjalan di proses Next, dan proses lain tidak bisa memakainya. Sekarang satu sumber
 * kebenaran: `apps/api`. Modul ini menyiapkan dua hal yang hanya diketahui proses web:
 *
 * 1. **cookie sesi** browser → diteruskan apa adanya, karena `apps/api` yang memutuskan valid/tidak.
 * 2. **origin/referer** permintaan asli → diteruskan supaya penjaga CSRF di API memeriksa nilai yang
 *    benar-benar dikirim browser, bukan nilai karangan sisi server. Tanpa ini, permintaan dari
 *    server component akan ditolak di produksi (`originAllowed` hanya melonggar di development).
 *
 * Tidak ada keputusan otorisasi di sini: 401/403 dari API diteruskan sebagai error, bukan ditelan.
 */

/** Header yang dibutuhkan `apps/api`: identitas sesi + asal permintaan. */
async function upstreamHeaders(): Promise<Record<string, string>> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const cookie = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const origin = headerStore.get("origin");
  const referer = headerStore.get("referer");

  return {
    ...(cookie ? { cookie } : {}),
    ...(origin ? { origin } : {}),
    ...(!origin && referer ? { referer } : {}),
  };
}

async function call<T>(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const envelope = await apiFetch<{ data: T }>(path, {
    ...init,
    headers: await upstreamHeaders(),
  });
  return envelope.data;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export function listRolesDetailed(): Promise<RoleDetail[]> {
  return call<RoleDetail[]>("/api/rbac/roles");
}

export async function createRole(_actorId: string, input: unknown): Promise<void> {
  await call("/api/rbac/roles", { method: "POST", body: input });
}

export async function updateRole(_actorId: string, input: unknown): Promise<void> {
  const { roleId, ...rest } = input as { roleId: string };
  await call(`/api/rbac/roles/${encodeURIComponent(roleId)}`, { method: "PUT", body: rest });
}

export async function updateRolePermissions(_actorId: string, input: unknown): Promise<void> {
  const { roleId, ...rest } = input as { roleId: string };
  await call(`/api/rbac/roles/${encodeURIComponent(roleId)}/permissions`, {
    method: "PUT",
    body: rest,
  });
}

export async function deleteRole(_actorId: string, roleId: string): Promise<void> {
  await call(`/api/rbac/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function listUsersDetailed(): Promise<UserDetail[]> {
  return call<UserDetail[]>("/api/rbac/users");
}

/** Buat user baru. Password plaintext lewat body, langsung di-hash di `apps/api`. */
export function createUser(_actorId: string, input: unknown): Promise<{ id: string; username: string }> {
  return call<{ id: string; username: string }>("/api/rbac/users", { method: "POST", body: input });
}

export async function setUserActive(_actorId: string, input: unknown): Promise<void> {
  const { userId, ...rest } = input as { userId: string };
  await call(`/api/rbac/users/${encodeURIComponent(userId)}/active`, {
    method: "PUT",
    body: rest,
  });
}

// ---------------------------------------------------------------------------
// Pemberian role + four-eyes
// ---------------------------------------------------------------------------

export function listPendingRoleRequests(): Promise<PendingRoleRequest[]> {
  return call<PendingRoleRequest[]>("/api/rbac/role-requests");
}

/**
 * Mengembalikan `{ requiresApproval }`: `true` bila role sensitif sehingga hanya tercatat sebagai
 * permintaan PENDING yang harus disetujui orang lain (four-eyes), `false` bila langsung diberikan.
 */
export function grantRole(
  _actorId: string,
  input: unknown,
): Promise<{ requiresApproval: boolean }> {
  return call<{ requiresApproval: boolean }>("/api/rbac/user-roles/grant", {
    method: "POST",
    body: input,
  });
}

export function revokeRole(
  _actorId: string,
  input: unknown,
): Promise<{ requiresApproval: boolean }> {
  return call<{ requiresApproval: boolean }>("/api/rbac/user-roles/revoke", {
    method: "POST",
    body: input,
  });
}

export async function reviewRoleRequest(_actorId: string, input: unknown): Promise<void> {
  const { requestId, ...rest } = input as { requestId: string };
  await call(`/api/rbac/role-requests/${encodeURIComponent(requestId)}/review`, {
    method: "POST",
    body: rest,
  });
}

export type { RoleDetail, UserDetail, PendingRoleRequest };
