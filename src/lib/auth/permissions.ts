/**
 * Role → permission matrix. Pure and isomorphic: client components may import it to hide
 * controls, but the server always re-checks through requireUser({ permission }).
 */

export const ROLES = ["owner", "editor", "agent"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "pages.read",
  "pages.write",
  "pages.publish",
  "media.write",
  "orders.read",
  "orders.write",
  "settings.read",
  "settings.write",
  "users.manage",
  "export.create",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  /** full control, including users and settings */
  owner: new Set<Permission>(PERMISSIONS),
  /** builds, publishes and exports pages; can look at orders and settings */
  editor: new Set<Permission>([
    "pages.read",
    "pages.write",
    "pages.publish",
    "media.write",
    "export.create",
    "orders.read",
    "settings.read",
  ]),
  /** call-center agent: works the order queue only */
  agent: new Set<Permission>(["orders.read", "orders.write"]),
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.has(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return PERMISSIONS.filter((p) => can(role, p));
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  agent: "Order agent",
};

/** Where a user lands after sign-in when no specific page was requested. */
export function homePathFor(role: Role): string {
  return role === "agent" ? "/admin/orders" : "/admin";
}
