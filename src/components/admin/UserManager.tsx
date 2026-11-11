"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck, UserX, Check, X, Hourglass } from "lucide-react";
import {
  grantRoleAction,
  revokeRoleAction,
  reviewRoleRequestAction,
  setUserActiveAction,
} from "@/app/admin/(dashboard)/users/actions";
import type { UserDetail } from "@/server/services/rbac.service";

interface RoleOption {
  id: string;
  key: string;
  name: string;
  isSensitive: boolean;
}

interface PendingRequest {
  id: string;
  action: string;
  reason: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  role: { id: string; key: string; name: string };
  requestedBy: { id: string; name: string; email: string };
}

interface UserManagerProps {
  users: UserDetail[];
  requests: PendingRequest[];
  roles: RoleOption[];
  currentUserId: string;
  canManageUsers: boolean;
  canReview: boolean;
}

export function UserManager({
  users,
  requests,
  roles: roleOptions,
  currentUserId,
  canManageUsers,
  canReview,
}: UserManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<{ ok: boolean; error?: string; requiresApproval?: boolean }>, successMsg: string) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(
          res.requiresApproval
            ? "Request created — awaiting independent approval (four-eyes)"
            : successMsg
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  };

  const handleGrant = (userId: string, userEmail: string) => {
    const roleId = selectedRole[userId];
    const reason = reasons[userId] ?? "";
    if (!roleId) {
      toast.error("Select a role first");
      return;
    }
    if (reason.trim().length < 4) {
      toast.error("Provide a reason (min 4 characters) for the audit trail");
      return;
    }
    run(
      () =>
        grantRoleAction({ userId, roleId, reason: reason.trim() }),
      `Role granted to ${userEmail}`
    );
  };

  const handleRevoke = (
    userId: string,
    roleId: string,
    userEmail: string,
    roleName: string
  ) => {
    const reason = reasons[userId] ?? "";
    if (reason.trim().length < 4) {
      toast.error("Provide a reason (min 4 characters) for the audit trail");
      return;
    }
    run(
      () => revokeRoleAction({ userId, roleId, reason: reason.trim() }),
      `Role "${roleName}" revoked from ${userEmail}`
    );
  };

  const handleToggleActive = (user: UserDetail) => {
    if (
      !user.isActive &&
      !window.confirm(`Activate account ${user.email}?`)
    )
      return;
    run(
      () => setUserActiveAction({ userId: user.id, isActive: !user.isActive }),
      `Account ${user.email} ${user.isActive ? "deactivated" : "activated"}`
    );
  };

  const handleReview = (requestId: string, approve: boolean) => {
    if (
      approve &&
      !window.confirm(
        "Approve this sensitive role change? You cannot review your own requests."
      )
    )
      return;
    run(
      () =>
        reviewRoleRequestAction({
          requestId,
          approve,
          reviewNote: approve ? "" : "Rejected via dashboard",
        }),
      approve ? "Request approved" : "Request rejected"
    );
  };

  return (
    <div className="space-y-6 text-ink select-none">
      {/* Header */}
      <div className="pb-4 border-b border-subtle">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="bg-fight-red text-ink font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
            USER ADMINISTRATION
          </span>
          <span className="border border-subtle text-ink-muted font-mono-data text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
            FOUR-EYES ENFORCED
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink uppercase font-black">
          USERS & ROLE ASSIGNMENT
        </h1>
        <p className="font-mono-data text-xs text-ink-muted mt-1">
          Assign non-sensitive roles directly. Sensitive roles require an
          independent approval before taking effect.
        </p>
      </div>

      {/* Pending Role Requests */}
      {canReview && (
        <div className="bg-charcoal border border-subtle p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-fight-red" />
            <h2 className="font-display text-lg uppercase font-black">
              Pending Role Requests
            </h2>
            <span className="font-mono-data text-[10px] bg-fight-red text-ink font-bold px-1.5 py-0.5">
              {requests.length}
            </span>
          </div>
          {requests.length === 0 ? (
            <p className="font-mono-data text-xs text-ink-subtle">
              No pending sensitive role requests.
            </p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => {
                const isOwnRequest = r.requestedBy.id === currentUserId;
                return (
                  <div
                    key={r.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-subtle bg-canvas-deep p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-mono-data text-xs text-ink font-bold">
                        <span className={r.action === "GRANT" ? "text-fight-red" : "text-fight-red"}>
                          {r.action}
                        </span>{" "}
                        {r.role.name} → {r.user.name} ({r.user.email})
                      </p>
                      <p className="font-mono-data text-[10px] text-ink-muted mt-0.5">
                        Requested by {r.requestedBy.name} ·{" "}
                        {new Date(r.createdAt).toLocaleString()} · &ldquo;
                        {r.reason}&rdquo;
                      </p>
                    </div>
                    {isOwnRequest ? (
                      <span className="font-mono-data text-[10px] text-ink-subtle border border-subtle px-2 py-1 uppercase font-bold shrink-0">
                        YOUR REQUEST
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReview(r.id, true)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 font-mono-data text-[10px] font-bold bg-charcoal text-ink hover:bg-surface-elevated px-3 py-1.5 uppercase transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> APPROVE
                        </button>
                        <button
                          onClick={() => handleReview(r.id, false)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 font-mono-data text-[10px] font-bold text-fight-red hover:text-ink hover:bg-fight-red border border-fight-red px-3 py-1.5 uppercase transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3 h-3" /> REJECT
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Users Table */}
      {canManageUsers && (
        <div className="space-y-3">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const remainingRoles = roleOptions.filter(
              (ro) => !user.roles.some((ur) => ur.id === ro.id)
            );
            return (
              <div
                key={user.id}
                className="bg-charcoal border border-subtle p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-lg uppercase font-black text-ink">
                        {user.name}
                      </span>
                      {isSelf && (
                        <span className="font-mono-data text-[9px] bg-charcoal text-ink px-1.5 py-0.5 uppercase font-bold">
                          YOU
                        </span>
                      )}
                      <span
                        className={`font-mono-data text-[9px] px-1.5 py-0.5 uppercase font-bold ${
                          user.isActive
                            ? "bg-surface-elevated text-ink"
                            : "bg-fight-red text-ink"
                        }`}
                      >
                        {user.isActive ? "ACTIVE" : "DISABLED"}
                      </span>
                      {user.mfaEnabled && (
                        <span className="font-mono-data text-[9px] border border-fight-red text-fight-red px-1.5 py-0.5 uppercase font-bold">
                          MFA
                        </span>
                      )}
                    </div>
                    <p className="font-mono-data text-[10px] text-ink-muted mt-0.5">
                      {user.email}
                      {user.lastLoginAt &&
                        ` · last login ${new Date(user.lastLoginAt).toLocaleString()}`}
                    </p>
                  </div>

                  <button
                    onClick={() => handleToggleActive(user)}
                    disabled={pending || isSelf}
                    title={
                      isSelf
                        ? "You cannot deactivate your own account"
                        : user.isActive
                          ? "Deactivate account and revoke sessions"
                          : "Activate account"
                    }
                    className={`inline-flex items-center gap-1.5 font-mono-data text-[10px] font-bold px-3 py-1.5 uppercase transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      user.isActive
                        ? "text-fight-red hover:text-ink hover:bg-fight-red border border-fight-red"
                        : "bg-charcoal text-ink hover:bg-surface-elevated"
                    }`}
                  >
                    {user.isActive ? (
                      <>
                        <UserX className="w-3 h-3" /> DEACTIVATE
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3 h-3" /> ACTIVATE
                      </>
                    )}
                  </button>
                </div>

                {/* Role chips */}
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.length === 0 && (
                    <span className="font-mono-data text-[10px] text-ink-subtle">
                      No roles assigned
                    </span>
                  )}
                  {user.roles.map((r) => (
                    <span
                      key={r.id}
                      className={`inline-flex items-center gap-1.5 font-mono-data text-[10px] font-bold px-2 py-1 uppercase ${
                        r.isSensitive
                          ? "bg-fight-red/15 text-fight-red border border-fight-red/40"
                          : "bg-surface-elevated text-ink border border-subtle"
                      }`}
                    >
                      {r.name}
                      {!r.isSensitive && (
                        <button
                          onClick={() =>
                            handleRevoke(user.id, r.id, user.email, r.name)
                          }
                          disabled={pending}
                          className="hover:text-fight-red cursor-pointer disabled:opacity-50"
                          title={`Revoke ${r.name} (reason required)`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {r.isSensitive && (
                        <span title="Sensitive role — revoke via request (four-eyes)">
                          <Hourglass className="w-3 h-3" />
                        </span>
                      )}
                    </span>
                  ))}
                </div>

                {/* Grant row */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <select
                    value={selectedRole[user.id] ?? ""}
                    onChange={(e) =>
                      setSelectedRole((prev) => ({
                        ...prev,
                        [user.id]: e.target.value,
                      }))
                    }
                    className="bg-canvas border border-subtle px-3 py-2 font-mono-data text-xs text-ink outline-none focus:border-white flex-1"
                  >
                    <option value="">— Select role to grant —</option>
                    {remainingRoles.map((ro) => (
                      <option key={ro.id} value={ro.id}>
                        {ro.name}
                        {ro.isSensitive ? " (sensitive — needs approval)" : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    value={reasons[user.id] ?? ""}
                    onChange={(e) =>
                      setReasons((prev) => ({
                        ...prev,
                        [user.id]: e.target.value,
                      }))
                    }
                    placeholder="Reason (audit trail, required)"
                    className="bg-canvas border border-subtle px-3 py-2 font-mono-data text-xs text-ink outline-none focus:border-white flex-1 placeholder:text-ink-subtle"
                  />
                  <button
                    onClick={() => handleGrant(user.id, user.email)}
                    disabled={pending}
                    className="font-mono-data text-[10px] font-bold bg-fight-red hover:bg-fight-red-hover text-ink px-4 py-2 uppercase transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    GRANT
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canManageUsers && (
        <div className="bg-canvas-deep border border-subtle p-4">
          <p className="font-mono-data text-[11px] text-ink-muted">
            You have <code className="text-ink">roles.manage</code> only — you
            can review pending sensitive role requests above but cannot edit
            users directly.
          </p>
        </div>
      )}
    </div>
  );
}
