/**
 * Single source of truth for permissions and default roles.
 * Used by: seed, authorization guards, admin UI, tests, docs (docs/RBAC.md).
 * Changing this file requires re-running the seed (idempotent upsert) and updating docs/RBAC.md.
 */

export const PERMISSIONS = {
  "admin.access": "Access the admin dashboard (read-only operational views)",
  "fighters.read": "View fighter records including private fields",
  "fighters.create": "Create fighters",
  "fighters.update": "Update fighters",
  "fighters.delete": "Delete (soft) fighters",
  "rankings.read": "View ranking drafts and history",
  "rankings.manage": "Create and edit ranking drafts, submit for approval",
  "rankings.publish": "Approve and publish official rankings",
  "fights.manage": "Create/edit fights and prepare fight results",
  "fights.verify": "Verify submitted fight results (first approval step)",
  "fights.approve": "Approve verified fight results as OFFICIAL",
  "events.manage": "Create and edit events",
  "tournaments.manage": "Manage Grand Prix tournaments, participants and brackets",
  "belts.manage": "Manage championship belts, propose holder changes, record defenses",
  "belts.approve": "Approve championship belt holder changes",
  "content.manage": "Edit landing page, hero slides, media, sponsors (draft)",
  "content.publish": "Publish landing page revisions and roll back",
  "users.manage": "Manage users, assign non-sensitive roles, revoke sessions",
  "roles.manage": "Manage roles/permissions and approve sensitive role changes",
  "settings.manage": "Manage organization settings",
  "audit.read": "Read audit logs and login monitoring",
  "ticketing.read": "View ticket orders and payment confirmation queue",
  "ticketing.manage": "Create ticket types and manage ticket orders",
  "ticketing.confirm": "Confirm or reject ticket payments",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export type RoleKey =
  | "super_admin"
  | "administrator"
  | "ranking_manager"
  | "tournament_manager"
  | "editor"
  | "fight_data_manager"
  | "reviewer"
  | "viewer";

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  isSystem: boolean;
  requiresMfa: boolean;
  isSensitive: boolean;
  permissions: readonly PermissionKey[];
}

export const DEFAULT_ROLES: readonly RoleDefinition[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Full system access, user/role management, configuration, publish & approval.",
    isSystem: true,
    requiresMfa: true,
    isSensitive: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "administrator",
    name: "Administrator",
    description: "General operations: fighters, events, content, tournaments, belts and limited settings.",
    isSystem: true,
    requiresMfa: true,
    isSensitive: true,
    permissions: [
      "admin.access",
      "fighters.read",
      "fighters.create",
      "fighters.update",
      "fighters.delete",
      "rankings.read",
      "fights.manage",
      "events.manage",
      "tournaments.manage",
      "belts.manage",
      "content.manage",
      "content.publish",
      "settings.manage",
      "audit.read",
      "ticketing.read",
      "ticketing.manage",
      "ticketing.confirm",
    ],
  },
  {
    key: "ranking_manager",
    name: "Ranking Manager",
    description: "Prepares ranking drafts and submits them for approval. Cannot publish unless explicitly granted.",
    isSystem: true,
    requiresMfa: false,
    isSensitive: false,
    permissions: ["admin.access", "fighters.read", "rankings.read", "rankings.manage"],
  },
  {
    key: "tournament_manager",
    name: "Tournament Manager",
    description: "Manages Grand Prix tournaments, brackets, participants and prepares fight results.",
    isSystem: true,
    requiresMfa: false,
    isSensitive: false,
    permissions: ["admin.access", "fighters.read", "tournaments.manage", "fights.manage", "ticketing.read"],
  },
  {
    key: "editor",
    name: "Editor",
    description: "Edits landing page, hero slider, media and content as drafts. Cannot publish by default.",
    isSystem: true,
    requiresMfa: false,
    isSensitive: false,
    permissions: ["admin.access", "fighters.read", "content.manage", "ticketing.read", "ticketing.manage"],
  },
  {
    key: "fight_data_manager",
    name: "Fight Data Manager",
    description: "Manages fight records and prepares results. Cannot verify or approve results.",
    isSystem: true,
    requiresMfa: false,
    isSensitive: false,
    permissions: ["admin.access", "fighters.read", "fights.manage"],
  },
  {
    key: "reviewer",
    name: "Reviewer / Approver",
    description: "Reviews and approves rankings, fight results, belt changes and content. Four-eyes policy applies.",
    isSystem: true,
    requiresMfa: true,
    isSensitive: true,
    permissions: [
      "admin.access",
      "fighters.read",
      "rankings.read",
      "rankings.publish",
      "fights.verify",
      "fights.approve",
      "belts.approve",
      "content.publish",
      "ticketing.read",
      "ticketing.confirm",
    ],
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only access to the dashboard.",
    isSystem: true,
    requiresMfa: false,
    isSensitive: false,
    permissions: ["admin.access", "fighters.read", "rankings.read"],
  },
] as const;

