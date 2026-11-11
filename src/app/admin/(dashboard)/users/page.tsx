import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import {
  listUsersDetailed,
  listPendingRoleRequests,
  listRolesDetailed,
} from "@/server/services/rbac.service";
import { UserManager } from "@/components/admin/UserManager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const canManageUsers = hasPermission(session, "users.manage");
  const canReview = hasPermission(session, "roles.manage");

  if (!canManageUsers && !canReview) {
    return (
      <div className="space-y-4 text-ink select-none">
        <h1 className="font-display text-3xl uppercase font-black">
          User Management
        </h1>
        <div className="border border-fight-red bg-charcoal p-8 text-center">
          <p className="font-mono-data text-sm font-bold text-fight-red uppercase">
            Access Denied
          </p>
          <p className="font-mono-data text-xs text-ink-muted mt-2">
            Required permission: <code>users.manage</code> or{" "}
            <code>roles.manage</code>.
          </p>
        </div>
      </div>
    );
  }

  const [users, requests, roles] = await Promise.all([
    canManageUsers ? listUsersDetailed() : Promise.resolve([]),
    listPendingRoleRequests(),
    canManageUsers ? listRolesDetailed() : Promise.resolve([]),
  ]);

  return (
    <UserManager
      users={users}
      requests={requests}
      roles={roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        isSensitive: r.isSensitive,
      }))}
      currentUserId={session.id}
      canManageUsers={canManageUsers}
      canReview={canReview}
    />
  );
}
