import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type AuditAction =
  // Contacts
  | "contact.create"
  | "contact.update"
  | "contact.delete"
  | "contact.import"
  | "contact.bulk_tag"
  // Lists
  | "list.create"
  // Email
  | "email.template.create"
  | "email.template.update"
  | "email.template.delete"
  | "email.campaign.create"
  | "email.campaign.send"
  // Outreach (workbench)
  | "outreach.send"
  // Social
  | "social.post.create"
  | "social.post.publish"
  | "social.post.update"
  | "social.post.delete"
  // Team / workspace
  | "team.invite"
  | "team.invite.revoke"
  | "team.role.change"
  | "team.remove"
  | "team.transfer_ownership"
  // Exports
  | "export.contacts"
  | "export.sends"
  | "export.mentions";

export async function logAudit(entry: {
  workspaceId: string;
  userId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      workspaceId: entry.workspaceId,
      userId: entry.userId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      meta: entry.meta ?? null,
    });
  } catch (err) {
    // Audit failures must never break the originating action.
    console.error("[audit] failed to record event", entry.action, err);
  }
}
