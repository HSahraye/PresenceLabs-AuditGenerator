import { trackEvent } from "@/lib/events";

export async function trackProductAnalytics(input: {
  workspaceId: string;
  event: string;
  leadId?: string;
  properties?: Record<string, unknown>;
}) {
  await trackEvent(
    `product.${input.event}`,
    {
      ...(input.properties || {}),
      workspaceId: input.workspaceId,
    },
    input.leadId,
    input.workspaceId,
  );
}
