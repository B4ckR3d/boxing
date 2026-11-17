"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldCheck,
  Lock,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Save,
  KeyRound,
} from "lucide-react";
import {
  PERMISSIONS,
  DEFAULT_ROLES,
  type PermissionKey,
} from "@/lib/permissions/catalog";
import {
  createRoleAction,
  updateRoleAction,
  updateRolePermissionsAction,
  deleteRoleAction,
} from "@/app/admin/(dashboard)/roles/actions";
import type { RoleDetail } from "@/server/services/rbac.service";

interface RoleManagerProps {
  roles: RoleDetail[];
}

/** Groups permission keys by their namespace prefix (e.g. "fighters", "rankings") */
function groupPermissions(keys: string[]) {
  const groups = new Map<string, { key: string; description: string }[]>();
  for (const key of keys) {
    const ns = key.split(".")[0] ?? "other";
    if (!groups.has(ns)) groups.set(ns, []);
    groups.get(ns)!.push({
      key,
      description: PERMISSIONS[key as PermissionKey] ?? key,
    });
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function RoleManager({ roles }: RoleManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(roles.map((r) => [r.id, r.permissions]))
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({ key: "", name: "", description: "" });

  const allPermissions = useMemo(() => Object.keys(PERMISSIONS), []);

  const togglePermission = (roleId: string, key: string) => {
    setDrafts((prev) => {
      const current = prev[roleId] ?? [];
      return {
        ...prev,
        [roleId]: current.includes(key)
          ? current.filter((k) => k !== key)
          : [...current, key],
      };
    });
  };

  const savePermissions = (role: RoleDetail) => {
    const permissions = drafts[role.id] ?? [];
    startTransition(async () => {
      const res = await updateRolePermissionsAction({
        roleId: role.id,
        permissions,
      });
      if (res.ok) {
        toast.success(`Permissions for "${role.name}" saved`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to save permissions");
      }
    });
  };

  const saveMeta = (role: RoleDetail) => {
    const def = DEFAULT_ROLES.find((d) => d.key === role.key);
    if (!def) {
      toast.error("No catalog definition for this role");
      return;
    }
    startTransition(async () => {
      const res = await updateRoleAction({
        roleId: role.id,
        name: def.name,
        description: def.description,
        requiresMfa: def.requiresMfa,
      });
      if (res.ok) {
        toast.success("Role saved");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to save role");
      }
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createRoleAction(newRole);
      if (res.ok) {
        toast.success(`Role "${newRole.name}" created`);
        setNewRole({ key: "", name: "", description: "" });
        setShowCreate(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to create role");
      }
    });
  };

  const handleDelete = (role: RoleDetail) => {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteRoleAction(role.id);
      if (res.ok) {
        toast.success(`Role "${role.name}" deleted`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to delete role");
      }
    });
  };

  return (
    <div className="space-y-6 text-ink select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              ACCESS CONTROL
            </span>
            <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              RBAC CONFIGURATION
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
            ROLES & PERMISSIONS
          </h1>
          <p className="font-mono-data text-xs text-ink-muted mt-1">
            Configure which permissions each role holds. Sensitive role
            assignments to users require four-eyes approval on the Users page.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 font-mono-data text-xs font-bold bg-fight-red hover:bg-fight-red-hover text-ink px-4 py-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> NEW ROLE
        </button>
      </div>

      {/* Create Role Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-charcoal border border-subtle p-5 space-y-4"
        >
          <h2 className="font-display text-lg uppercase font-black">
            Create Custom Role
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="font-mono-data text-[10px] uppercase text-ink-muted space-y-1">
              Key (snake_case)
              <input
                required
                value={newRole.key}
                onChange={(e) =>
                  setNewRole((r) => ({ ...r, key: e.target.value }))
                }
                placeholder="media_manager"
                className="w-full bg-canvas border border-subtle px-3 py-2 text-sm text-ink outline-none focus:border-white"
              />
            </label>
            <label className="font-mono-data text-[10px] uppercase text-ink-muted space-y-1">
              Name
              <input
                required
                value={newRole.name}
                onChange={(e) =>
                  setNewRole((r) => ({ ...r, name: e.target.value }))
                }
                placeholder="Media Manager"
                className="w-full bg-canvas border border-subtle px-3 py-2 text-sm text-ink outline-none focus:border-white"
              />
            </label>
            <label className="font-mono-data text-[10px] uppercase text-ink-muted space-y-1">
              Description
              <input
                value={newRole.description}
                onChange={(e) =>
                  setNewRole((r) => ({ ...r, description: e.target.value }))
                }
                placeholder="Manages media library"
                className="w-full bg-canvas border border-subtle px-3 py-2 text-sm text-ink outline-none focus:border-white"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="font-mono-data text-xs font-bold bg-fight-red hover:bg-fight-red-hover text-ink px-4 py-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {pending ? "CREATING..." : "CREATE ROLE"}
          </button>
        </form>
      )}

      {/* Role Cards */}
      <div className="space-y-3">
        {roles.map((role) => {
          const isSuperAdminRole = role.key === "super_admin";
          const immutable = isSuperAdminRole;
          const expanded = expandedId === role.id;
          const draft = drafts[role.id] ?? [];
          const dirty =
            JSON.stringify([...draft].sort()) !==
            JSON.stringify([...role.permissions].sort());

          return (
            <div
              key={role.id}
              className="bg-charcoal border border-subtle hover:border-subtle transition-colors"
            >
              <div className="flex items-center justify-between gap-3 p-4">
                <button
                  onClick={() => setExpandedId(expanded ? null : role.id)}
                  className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-lg uppercase font-black text-ink">
                        {role.name}
                      </span>
                      <span className="font-mono-data text-[9px] text-ink-muted border border-subtle px-1.5 py-0.5 uppercase">
                        {role.key}
                      </span>
                      {role.isSystem && (
                        <span className="font-mono-data text-[9px] bg-surface-elevated text-ink px-1.5 py-0.5 uppercase font-bold">
                          SYSTEM
                        </span>
                      )}
                      {role.requiresMfa && (
                        <span className="font-mono-data text-[9px] bg-charcoal text-ink px-1.5 py-0.5 uppercase font-bold inline-flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> MFA
                        </span>
                      )}
                      {role.isSensitive && (
                        <span className="font-mono-data text-[9px] bg-fight-red text-ink px-1.5 py-0.5 uppercase font-bold">
                          SENSITIVE
                        </span>
                      )}
                    </div>
                    <p className="font-mono-data text-[10px] text-ink-muted mt-0.5 truncate">
                      {role.description || "No description"} ·{" "}
                      {role.userCount} user{role.userCount === 1 ? "" : "s"} ·{" "}
                      {role.permissions.length} permissions
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {immutable ? (
                    <span
                      className="inline-flex items-center gap-1 font-mono-data text-[10px] text-ink-muted border border-subtle px-2 py-1 uppercase font-bold"
                      title="Super Admin always holds every permission"
                    >
                      <Lock className="w-3 h-3" /> IMMUTABLE
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => savePermissions(role)}
                        disabled={pending || !dirty}
                        className={`inline-flex items-center gap-1.5 font-mono-data text-[10px] font-bold px-3 py-1.5 uppercase transition-colors cursor-pointer ${
                          dirty
                            ? "bg-charcoal text-ink hover:bg-surface-elevated"
                            : "bg-surface-elevated text-ink-subtle cursor-not-allowed"
                        }`}
                      >
                        <Save className="w-3 h-3" /> SAVE
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDelete(role)}
                          disabled={pending}
                          className="font-mono-data text-[10px] text-fight-red hover:text-ink hover:bg-fight-red border border-fight-red px-2 py-1.5 uppercase font-bold transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete role"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {expanded && (
                <div className="border-t border-subtle p-4 space-y-4 bg-canvas-deep">
                  {immutable ? (
                    <p className="font-mono-data text-xs text-ink-muted flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-fight-red" />
                      Super Admin implicitly holds all {allPermissions.length}{" "}
                      permissions. This role cannot be modified to prevent
                      lockout.
                    </p>
                  ) : (
                    groupPermissions(allPermissions).map(([ns, perms]) => (
                      <div key={ns}>
                        <p className="font-mono-data text-[10px] font-bold uppercase text-fight-red tracking-wider mb-2">
                          {ns}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {perms.map((p) => (
                            <label
                              key={p.key}
                              className={`flex items-start gap-2.5 p-2 border transition-colors cursor-pointer ${
                                draft.includes(p.key)
                                  ? "border-fight-red/60 bg-surface"
                                  : "border-subtle hover:border-ink-muted"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={draft.includes(p.key)}
                                onChange={() =>
                                  togglePermission(role.id, p.key)
                                }
                                className="mt-0.5 accent-[#e50914] cursor-pointer"
                              />
                              <span className="min-w-0">
                                <span className="font-mono-data text-[11px] font-bold text-ink block">
                                  {p.key}
                                </span>
                                <span className="font-mono-data text-[9px] text-ink-muted block leading-snug">
                                  {p.description}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}

                  {!immutable && role.isSystem && (
                    <button
                      onClick={() => saveMeta(role)}
                      disabled={pending}
                      className="font-mono-data text-[10px] text-ink-muted border border-subtle hover:border-ink-muted px-3 py-1.5 uppercase font-bold transition-colors cursor-pointer"
                    >
                      SYNC METADATA FROM CATALOG
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Four-eyes note */}
      <div className="bg-canvas-deep border border-subtle p-4 flex items-start gap-3">
        <KeyRound className="w-4 h-4 text-fight-red shrink-0 mt-0.5" />
        <p className="font-mono-data text-[11px] text-ink-muted leading-relaxed">
          Permission changes take effect on the user&apos;s next request (session
          permission set is rebuilt per request). All changes are recorded in the
          audit ledger. Grants/revokes of{" "}
          <span className="text-fight-red font-bold">SENSITIVE</span> roles
          require approval by a different{" "}
          <code className="text-ink">roles.manage</code> holder.
        </p>
      </div>
    </div>
  );
}
