import { trackEvent } from "@/lib/events";

export type SalesOsEvent =
  | "audit_generated"
  | "outreach_generated"
  | "proposal_generated"
  | "engagement_spike_detected"
  | "payment_intent_recorded"
  | "lead_progressed";

export async function trackSalesOsEvent(input: {
  eventType: SalesOsEvent;
  workspaceId?: string;
  leadId?: string;
  payload?: Record<string, unknown>;
}) {
  await trackEvent(
    `sales_os.${input.eventType}`,
    {
      ...(input.payload || {}),
      leadId: input.leadId ?? null,
    },
    input.leadId,
    input.workspaceId,
  );
}
