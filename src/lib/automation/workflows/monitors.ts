import { prisma } from "@/lib/prisma";
import { triggerWorkflows } from "@/lib/automation/workflows";
import { applyPipelineAutomation } from "@/lib/automation/pipeline";

export async function runAutomationMonitors(options?: { lookbackDays?: number; limit?: number }) {
  const lookbackDays = Math.max(1, options?.lookbackDays ?? 14);
  const staleBefore = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const limit = Math.max(10, Math.min(options?.limit ?? 100, 1000));
  const leads = await prisma.lead.findMany({
    where: {
      status: { notIn: ["Won", "Lost"] },
      OR: [{ lastContactedAt: null }, { lastContactedAt: { lte: staleBefore } }],
    },
    select: {
      id: true,
      workspaceId: true,
      lastContactedAt: true,
      nextFollowUpAt: true,
      outreachLogs: { take: 1, orderBy: { createdAt: "desc" }, select: { createdAt: true } },
      communicationEvents: {
        where: { eventType: "reply" },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      },
    },
    take: limit,
  });

  for (const lead of leads) {
    if (!lead.workspaceId) continue;
    const hasRecentReply = (lead.communicationEvents[0]?.createdAt?.getTime() ?? 0) > staleBefore.getTime();
    if (hasRecentReply) continue;
    await triggerWorkflows({
      workspaceId: lead.workspaceId,
      leadId: lead.id,
      eventType: "lead_no_response",
      payload: {
        lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
      },
    });
    await applyPipelineAutomation({
      workspaceId: lead.workspaceId,
      leadId: lead.id,
      trigger: "no_engagement",
    });
  }
}
