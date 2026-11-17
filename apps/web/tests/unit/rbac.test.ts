import { describe, it, expect } from "vitest";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
} from "@/lib/permissions/catalog";
import {
  hasPermission,
  assertFourEyes,
  FourEyesViolationError,
} from "@/lib/permissions/guard";
import type { AuthenticatedUser } from "@/server/services/auth.service";

describe("Role-Based Access Control (RBAC) Engine", () => {
  it("defines all system permissions uniquely", () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(20);
    const set = new Set(ALL_PERMISSIONS);
    expect(set.size).toBe(ALL_PERMISSIONS.length);
  });

  it("assigns full permissions to super_admin role", () => {
    const superAdmin = DEFAULT_ROLES.find((r) => r.key === "super_admin");
    expect(superAdmin).toBeDefined();
    expect(superAdmin?.permissions.length).toBe(ALL_PERMISSIONS.length);
  });

  it("restricts viewer role to read-only capabilities", () => {
    const viewer = DEFAULT_ROLES.find((r) => r.key === "viewer");
    expect(viewer).toBeDefined();
    expect(viewer?.permissions).toEqual(["admin.access", "fighters.read", "rankings.read"]);
    expect(viewer?.permissions.includes("rankings.publish")).toBe(false);
    expect(viewer?.permissions.includes("fights.approve")).toBe(false);
  });

  it("checks permissions correctly for authenticated user object", () => {
    const testUser: AuthenticatedUser = {
      id: "u1",
      email: "rankingmgr@boxing.local",
      name: "Ranking Manager",
      isActive: true,
      mfaEnabled: false,
      roles: ["ranking_manager"],
      permissions: new Set(["admin.access", "rankings.read", "rankings.manage"]),
      sessionId: "s1",
      mfaVerified: false,
    };

    expect(hasPermission(testUser, "rankings.manage")).toBe(true);
    expect(hasPermission(testUser, "rankings.publish")).toBe(false);
    expect(hasPermission(testUser, "fights.approve")).toBe(false);
  });

  it("enforces four-eyes separation of duties", () => {
    const actorId = "user_editor_123";
    const sameInitiatorId = "user_editor_123";
    const differentInitiatorId = "user_data_mgr_456";

    // Same initiator should throw FourEyesViolationError
    expect(() =>
      assertFourEyes(actorId, sameInitiatorId, "fight result approval")
    ).toThrow(FourEyesViolationError);

    // Different initiator should succeed without throwing
    expect(() =>
      assertFourEyes(actorId, differentInitiatorId, "fight result approval")
    ).not.toThrow();
  });
});

