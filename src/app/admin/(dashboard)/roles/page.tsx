import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import { listRolesDetailed } from "@/server/services/rbac.service";
import { RoleManager } from "@/components/admin/RoleManager";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  if (!hasPermission(session, "roles.manage")) {
    return (
      <div className="space-y-4 text-ink select-none">
        <h1 className="font-display text-3xl uppercase font-black">
          Roles & Permissions
        </h1>
        <div className="border border-fight-red bg-charcoal p-8 text-center">
          <p className="font-mono-data text-sm font-bold text-fight-red uppercase">
            Access Denied
          </p>
          <p className="font-mono-data text-xs text-ink-muted mt-2">
            Required permission: <code>roles.manage</code>. Contact a Super Admin
            if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  const roles = await listRolesDetailed();

  return <RoleManager roles={roles} />;
}
