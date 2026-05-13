import { prisma } from "./prisma";
import { logger } from "./logger";
import type { AppRole } from "./auth";

export async function writeAuditLog(input: {
  action: string;
  actorRole: AppRole | "system";
  leadId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorRole: input.actorRole,
        leadId: input.leadId || null,
        metadataJson: JSON.stringify(input.metadata || {}),
      },
    });
  } catch (error) {
    logger.warn("audit_log_failed", { action: input.action, error: error instanceof Error ? error.message : "unknown" });
  }
}
