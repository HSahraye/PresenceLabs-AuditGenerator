import { logger } from "@/lib/logger";

export function captureError(error: unknown, context: { area: string; workspaceId?: string; extra?: Record<string, unknown> }) {
  const message = error instanceof Error ? error.message : "unknown_error";
  logger.error("captured_error", {
    area: context.area,
    workspaceId: context.workspaceId,
    message,
    ...(context.extra || {}),
  });
}

export function logOperationalMetric(name: string, payload: Record<string, unknown>) {
  logger.info("metric", {
    metric: name,
    ...payload,
  });
}
