# Role-Based Access Control (RBAC) Specification & Permission Matrix

> **Status:** v1.0 — Implemented in `src/lib/permissions/catalog.ts`  
> **Source of Truth:** [prd.md](../prd.md)  

---

## 1. Principles of Security

1. **Backend-Enforced Authorization:** Every REST Route Handler and Server Action verifies permissions using `assertPermission()` or `hasPermission()`. Client-side rendering conditions exist solely for UX.
2. **Least Privilege & Role Segregation:** Specific roles are limited to their operational scope (e.g., Fight Data Manager can draft results but cannot mark them official).
3. **Four-Eyes Policy (Separation of Duties):**
   - A user who prepares a fight result cannot verify or approve it.
   - A user who creates a ranking draft cannot approve or publish it.
   - Assigning sensitive roles (`super_admin`, `administrator`, `reviewer`) requires an approved `RoleRequest`.
4. **Mandatory TOTP MFA for Sensitive Roles:** Super Admin, Administrator, and Reviewer accounts require multi-factor authentication before session activation.
5. **Privilege Escalation Prevention:** Users cannot grant roles containing permissions they themselves do not possess.
6. **Immutable Audit Trail:** All role assignments, revocations, and requests are logged with actor ID, IP address, and timestamp.

---

## 2. Granular Permissions Catalog

| Permission Key | Description |
|---|---|
| `admin.access` | Access the admin dashboard shell and read basic operational views |
| `fighters.read` | View fighter records, including unlisted private contact details and notes |
| `fighters.create` | Create new fighter records |
| `fighters.update` | Edit existing fighter records |
| `fighters.delete` | Soft-delete fighter records |
| `rankings.read` | View ranking drafts, unapproved revisions, and internal change logs |
| `rankings.manage` | Create, edit, and reorder ranking drafts; submit draft for approval |
| `rankings.publish` | Approve and publish official ranking revisions (visible to the public) |
| `fights.manage` | Create and edit fight cards, assign fighters, and enter draft fight results |
| `fights.verify` | Formally verify fight results (Step 1 of approval workflow) |
| `fights.approve` | Certify verified fight results as OFFICIAL, updating records and belt lineages |
| `events.manage` | Schedule, edit, and publish fight night events and posters |
| `tournaments.manage` | Create Grand Prix tournaments, seed participants, and manage bracket progression |
| `belts.manage` | Create belts, edit descriptions, propose title vacancies or holder transitions |
| `belts.approve` | Certify championship belt title holder transitions |
| `content.manage` | Edit landing page sections, hero slider, media assets, and sponsors (draft mode) |
| `content.publish` | Publish landing page revisions and execute rollbacks |
| `users.manage` | Create user accounts, reset credentials, deactivate accounts, and revoke sessions |
| `roles.manage` | Edit role definitions and approve sensitive role escalation requests |
| `settings.manage` | Modify global organization settings, branding, and contact details |
| `audit.read` | View tamper-evident system audit logs and login attempt history |

---

## 3. Role-Permission Matrix

| Permission | Super Admin | Administrator | Ranking Manager | Tournament Manager | Editor | Fight Data Mgr | Reviewer / Approver | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `admin.access` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `fighters.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `fighters.create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `fighters.update` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `fighters.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `rankings.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `rankings.manage` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `rankings.publish` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `fights.manage` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `fights.verify` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `fights.approve` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `events.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `tournaments.manage` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `belts.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `belts.approve` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `content.manage` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `content.publish` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `users.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `settings.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit.read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Requires MFA** | **YES** | **YES** | NO | NO | NO | NO | **YES** | NO |
| **Sensitive Escalation** | **YES** | **YES** | NO | NO | NO | NO | **YES** | NO |

