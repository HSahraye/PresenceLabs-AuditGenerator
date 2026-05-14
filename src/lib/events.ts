import { prisma } from "./prisma";
import { logger } from "./logger";
import { getWorkspaceContext } from "./workspace";

export async function trackEvent(eventType: string, payload: Record<string, unknown>, leadId?: string, workspaceIdInput?: string) {
  try {
    const workspaceId = workspaceIdInput ?? (await getWorkspaceContext()).workspaceId;
    await prisma.eventLog.create({
      data: {
        workspaceId,
        eventType,
        leadId: leadId || null,
        payloadJson: JSON.stringify(payload),
      },
    });
  } catch (error) {
    logger.warn("event_track_failed", { eventType, error: error instanceof Error ? error.message : "unknown" });
  }
}
