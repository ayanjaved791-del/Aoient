import { describe, expect, it } from "vitest";
import { ALL_PERMISSION_KEYS, PERMISSIONS, SYSTEM_ROLES, isPermissionKey, type PermissionKey } from "@/server/permissions/catalog";
import { canActOnMember, canGrantRole, hasPermission, isOwner, isSubsetOf } from "@/server/permissions/evaluator";

const subject = (roleKey: string, perms: readonly PermissionKey[], isSystemRole = true) => ({
  roleKey, isSystemRole, permissions: new Set(perms),
});
const role = (key: string, perms: readonly PermissionKey[], isSystem = true) => ({ key, isSystem, permissions: new Set(perms) });

const owner = { ...subject("owner", SYSTEM_ROLES.owner.permissions), memberId: "m-owner" };
const admin = { ...subject("admin", SYSTEM_ROLES.admin.permissions), memberId: "m-admin" };
const employee = { ...subject("employee", SYSTEM_ROLES.employee.permissions), memberId: "m-emp" };

describe("permission catalogue", () => {
  it("has unique keys", () => {
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(PERMISSIONS.length);
  });
  it("system roles only reference catalogue keys", () => {
    for (const def of Object.values(SYSTEM_ROLES)) for (const p of def.permissions) expect(isPermissionKey(p)).toBe(true);
  });
  it("owner holds everything; admin lacks billing.manage; guest holds nothing", () => {
    expect(SYSTEM_ROLES.owner.permissions).toHaveLength(ALL_PERMISSION_KEYS.length);
    expect(SYSTEM_ROLES.admin.permissions).not.toContain("billing.manage");
    expect(SYSTEM_ROLES.guest.permissions).toHaveLength(0);
  });
  it("employees cannot see sensitive HR or finance data by default (spec §7)", () => {
    for (const p of ["people.employee.sensitive.read", "people.payroll.read", "finance.invoice.read"] as const) {
      expect(SYSTEM_ROLES.employee.permissions).not.toContain(p);
    }
    expect(SYSTEM_ROLES.sales_manager.permissions).not.toContain("people.employee.sensitive.read");
    expect(SYSTEM_ROLES.hr_manager.permissions).not.toContain("finance.invoice.read");
  });
  it("rejects unknown keys", () => {
    expect(isPermissionKey("organization.read")).toBe(true);
    expect(isPermissionKey("organization.*")).toBe(false);
    expect(isPermissionKey("")).toBe(false);
  });
});

describe("evaluator", () => {
  it("denies by default", () => {
    expect(hasPermission(subject("x", []), "organization.read")).toBe(false);
    expect(hasPermission(employee, "organization.members.invite")).toBe(false);
    expect(hasPermission(admin, "organization.members.invite")).toBe(true);
  });

  it("identifies owners only via the system owner role", () => {
    expect(isOwner(owner)).toBe(true);
    expect(isOwner(subject("owner", ALL_PERMISSION_KEYS, false))).toBe(false); // custom role named "owner"
  });

  it("isSubsetOf", () => {
    expect(isSubsetOf(["organization.read"], new Set<PermissionKey>(["organization.read", "billing.read"]))).toBe(true);
    expect(isSubsetOf(["billing.manage"], new Set<PermissionKey>(["organization.read"]))).toBe(false);
    expect(isSubsetOf([], new Set<PermissionKey>())).toBe(true);
  });

  describe("canGrantRole (privilege escalation)", () => {
    it("only owners grant the owner role", () => {
      expect(canGrantRole(admin, role("owner", SYSTEM_ROLES.owner.permissions)).allowed).toBe(false);
      expect(canGrantRole(owner, role("owner", SYSTEM_ROLES.owner.permissions)).allowed).toBe(true);
    });
    it("cannot grant permissions the actor lacks", () => {
      expect(canGrantRole(admin, role("custom-x", ["billing.manage"], false)).allowed).toBe(false);
      expect(canGrantRole(employee, role("admin", SYSTEM_ROLES.admin.permissions)).allowed).toBe(false);
    });
    it("can grant an equal or weaker role", () => {
      expect(canGrantRole(admin, role("employee", SYSTEM_ROLES.employee.permissions)).allowed).toBe(true);
      expect(canGrantRole(admin, role("admin", SYSTEM_ROLES.admin.permissions)).allowed).toBe(true);
    });
  });

  describe("canActOnMember", () => {
    it("forbids acting on yourself", () => {
      expect(canActOnMember(admin, { memberId: "m-admin", role: role("admin", SYSTEM_ROLES.admin.permissions) }).allowed).toBe(false);
    });
    it("admins cannot change owners; owners can", () => {
      const target = { memberId: "m-2", role: role("owner", SYSTEM_ROLES.owner.permissions) };
      expect(canActOnMember(admin, target).allowed).toBe(false);
      expect(canActOnMember(owner, target).allowed).toBe(true);
    });
    it("cannot act on a more privileged member", () => {
      const target = { memberId: "m-3", role: role("custom-billing", ["billing.manage"], false) };
      expect(canActOnMember(admin, target).allowed).toBe(false);
    });
  });
});
