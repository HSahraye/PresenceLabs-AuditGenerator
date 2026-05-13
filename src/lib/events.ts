import { prisma } from "./prisma";
import { logger } from "./logger";

export async function trackEvent(eventType: string, payload: Record<string, unknown>, leadId?: string) {
  try {
    await prisma.eventLog.create({
      data: {
        eventType,
        leadId: leadId || null,
        payloadJson: JSON.stringify(payload),
      },
    });
  } catch (error) {
    logger.warn("event_track_failed", { eventType, error: error instanceof Error ? error.message : "unknown" });
  }
}
