export type Role = "owner" | "admin" | "member" | "viewer";

/**
 * Capabilities a role grants. Granular so server actions can gate themselves
 * without checking role names directly.
 */
export const CAPABILITIES = {
  // Contacts
  "contacts.view": ["owner", "admin", "member", "viewer"],
  "contacts.create": ["owner", "admin", "member"],
  "contacts.edit": ["owner", "admin", "member"],
  "contacts.delete": ["owner", "admin"],
  "contacts.import": ["owner", "admin", "member"],

  // Lists
  "lists.create": ["owner", "admin", "member"],
  "lists.edit": ["owner", "admin", "member"],

  // Email
  "email.template.create": ["owner", "admin", "member"],
  "email.template.edit": ["owner", "admin", "member"],
  "email.template.delete": ["owner", "admin"],
  "email.campaign.create": ["owner", "admin", "member"],
  "email.campaign.send": ["owner", "admin"], // gate the actual send to admins+
  "email.view": ["owner", "admin", "member", "viewer"],

  // Outreach (DM workbench)
  "outreach.view": ["owner", "admin", "member", "viewer"],
  "outreach.campaign.create": ["owner", "admin", "member"],
  "outreach.send": ["owner", "admin", "member"],

  // Sentiment
  "sentiment.view": ["owner", "admin", "member", "viewer"],
  "sentiment.keywords.edit": ["owner", "admin"],

  // Social
  "social.view": ["owner", "admin", "member", "viewer"],
  "social.post.create": ["owner", "admin", "member"],
  "social.post.publish": ["owner", "admin"],
  "social.account.connect": ["owner", "admin"],

  // Team & workspace
  "team.invite": ["owner", "admin"],
  "team.role.change": ["owner"], // only owner can change roles
  "team.remove": ["owner", "admin"], // admin cannot remove owner
  "workspace.edit": ["owner"],
  "workspace.delete": ["owner"],
} as const satisfies Record<string, Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[cap] as readonly string[]).includes(role);
}

export function requireCap(role: Role | null | undefined, cap: Capability) {
  if (!can(role, cap)) {
    throw new Error(
      `Forbidden: role "${role ?? "none"}" lacks capability "${cap}"`,
    );
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner:
    "Full control. Change workspace settings, manage roles, delete data.",
  admin:
    "Manage contacts, send campaigns, post to social, invite teammates.",
  member:
    "Edit contacts, draft campaigns, run the outreach workbench. Cannot send bulk email or post publicly.",
  viewer: "Read-only access to dashboards and reports.",
};

export const ASSIGNABLE_ROLES: Role[] = ["admin", "member", "viewer"];
