import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

/**
 * Audit event types.
 */
export type AuditEventType =
  | "user.login"
  | "user.logout"
  | "user.register"
  | "user.profile_update"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "resource.create"
  | "resource.delete"
  | "template.create"
  | "template.update"
  | "template.delete"
  | "template.approve"
  | "template.reject"
  | "generation.create"
  | "generation.outline"
  | "generation.complete"
  | "generation.fail"
  | "document.export"
  | "document.delete"
  | "document.regenerate_section"
  | "billing.checkout"
  | "billing.verify"
  | "billing.cancel"
  | "admin.template_review";

/**
 * Audit log entry written to the database.
 */
export interface AuditLogEntry {
  user_id: string;
  event_type: AuditEventType;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * Write an audit log entry. This is fire-and-forget — failures are logged
 * but never block the calling operation.
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: entry.user_id,
      event_type: entry.event_type,
      target_type: entry.target_type,
      target_id: entry.target_id,
      metadata: entry.metadata,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Audit logging must never break the main flow
    logger.warn({ err, event_type: entry.event_type }, "audit log write failed");
  }
}

/**
 * Middleware factory: creates an audit log entry after a successful request.
 * Extracts user ID from req.user, event type and target from parameters.
 */
export function auditMiddleware(options: {
  eventType: AuditEventType;
  targetType: string;
  targetIdParam?: string; // request param name containing the target ID
  getMetadata?: (req: any) => Record<string, unknown>;
}) {
  return async (req: any, res: any, next: any) => {
    // Capture the original res.json to log after response is sent
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      originalJson(body);
      // Fire-and-forget audit log
      const userId = req.user?.id;
      const targetId = options.targetIdParam
        ? req.params?.[options.targetIdParam]
        : null;
      const metadata = options.getMetadata ? options.getMetadata(req) : {};

      auditLog({
        user_id: userId ?? "unknown",
        event_type: options.eventType,
        target_type: options.targetType,
        target_id: targetId,
        metadata,
        ip_address: req.ip ?? null,
        user_agent: req.get("User-Agent") ?? null,
      }).catch(() => {
        // ignore
      });
    };
    next();
  };
}
