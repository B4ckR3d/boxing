# RBAC

> Implementasi: `src/lib/permissions/catalog.ts` (definisi), `src/lib/permissions/guard.ts` (cek),
> `src/server/services/rbac.service.ts` (assign/revoke + four-eyes), halaman `/admin/roles` & `/admin/users`.

## 1. Model

```
User ──< UserRole >── Role ──< RolePermission >── Permission
```

- Permission = string `domain.action` (contoh `ticketing.confirm`).
- Role = kumpulan permission; `isSystem` tidak bisa dihapus; `super_admin` immutable.
- `requiresMfa`: pemegang role wajib MFA sebelum masuk dashboard.
- `isSensitive`: grant/revoke harus lewat `RoleRequest` (four-eyes), bukan aksi langsung.

## 2. Permission (24, nyata)

| Domain | Permission |
|---|---|
| admin | `admin.access` |
| audit | `audit.read` |
| belts | `belts.manage`, `belts.approve` |
| content | `content.manage`, `content.publish` |
| events | `events.manage` |
| fighters | `fighters.read`, `fighters.create`, `fighters.update`, `fighters.delete` |
| fights | `fights.manage`, `fights.verify`, `fights.approve` |
| rankings | `rankings.read`, `rankings.manage`, `rankings.publish` |
| roles/users | `roles.manage`, `users.manage` |
| settings | `settings.manage` |
| ticketing | `ticketing.read`, `ticketing.manage`, `ticketing.confirm` |
| tournaments | `tournaments.manage` |

## 3. Role seed (8, nyata)

`super_admin` (semua) · `administrator` · `ranking_manager` · `tournament_manager` · `editor` ·
`fight_data_manager` · `reviewer` · `viewer`.

> Role target dari spec (Organization Admin, Registration Admin, Cashier, Finance, Referee, Judge,
> Check-in Officer, …) **belum ada** — dibuat pada TFN-005 setelah modulnya jelas.

## 4. Cara memeriksa akses

```ts
// server
await requirePermission("ticketing.confirm");   // throw / redirect bila gagal
```

Aturan:

1. Cek **setiap** mutasi, bukan hanya halaman.
2. Jangan mengandalkan `if (role === 'admin')`.
3. Halaman yang tersembunyi tetap harus punya guard di server.
4. Permission baru wajib: masuk catalog → seed role → test allow **dan** deny.
5. Super admin tidak otomatis melewati audit: aksinya tetap dicatat.

## 5. Four-eyes

| Aksi | Alur |
|---|---|
| Grant/revoke role sensitif | user mengajukan `RoleRequest` → reviewer lain approve → baru berlaku |
| Transisi belt | pengajuan reign → approval orang kedua → aktif |
| Hasil pertandingan | entry → verify → approve (3 tahap, aktor berbeda) |
