import { OutboundMessageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateFollowupRecommendation } from "@/lib/intelligence/followup/brain";
import { enqueueOutboundMessage } from "@/lib/automation/outreach";

export async function runFollowupAutomation(input: {
  workspaceId: string;
  leadId: string;
  mode: "auto_draft" | "approval_required" | "auto_send";
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, workspaceId: input.workspaceId },
    include: {
      viewLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      paymentLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      communicationEvents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!lead || !lead.intelligenceJson) return { ok: false as const, error: "Lead intelligence is unavailable." };
  const intelligence = JSON.parse(lead.intelligenceJson) as {
    urgencyScore: number;
    outreachAngles: string[];
    objections: string[];
    [key: string]: unknown;
  };
  const recommendation = generateFollowupRecommendation({
    intelligence: intelligence as Parameters<typeof generateFollowupRecommendation>[0]["intelligence"],
    engagement: {
      viewCount: lead.viewLogs.length,
      revisitCount: Math.max(0, lead.viewLogs.length - 1),
      paymentClickCount: lead.paymentLogs.length,
      responseCount: lead.communicationEvents.filter((event) => event.eventType === "reply").length,
      outreachRecencyHours: lead.lastContactedAt ? (Date.now() - lead.lastContactedAt.getTime()) / 3_600_000 : 999,
    },
  });
  const body = `${recommendation.outreachFraming}\n\n${recommendation.recommendedNextStep}\n\n(${recommendation.urgencyLevel} urgency · ${recommendation.suggestedTiming})`;
  const status: OutboundMessageStatus =
    input.mode === "auto_send" ? "queued" : input.mode === "approval_required" ? "pending_approval" : "draft";
  const channel = recommendation.recommendedChannel === "note" ? "task" : recommendation.recommendedChannel;
  const message = await enqueueOutboundMessage({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    channel,
    subject: channel === "email" ? `Follow-up for ${lead.businessName}` : undefined,
    body,
    status,
    metadata: {
      source: "followup_automation",
      recommendation,
      mode: input.mode,
    },
  });
  return { ok: true as const, messageId: message.id, recommendation };
}
