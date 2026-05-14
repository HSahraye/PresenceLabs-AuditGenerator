import { prisma } from "@/lib/prisma";

export async function createActivity(input: {
  workspaceId: string;
  leadId?: string;
  type: string;
  detail?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activity.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId ?? null,
      type: input.type,
      detail: input.detail ?? null,
      source: input.source ?? "system",
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function getLeadTimeline(workspaceId: string, leadId: string) {
  const [activities, outreach, views, payments, messages, tasks] = await Promise.all([
    prisma.activity.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.outreachLog.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.viewLog.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.paymentLog.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.outboundMessage.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.task.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const merged = [
    ...activities.map((item) => ({ type: item.type, detail: item.detail, createdAt: item.createdAt, source: item.source })),
    ...outreach.map((item) => ({ type: `outreach.${item.type.toLowerCase()}`, detail: item.notes, createdAt: item.createdAt, source: "outreach" })),
    ...views.map((item) => ({ type: "audit.viewed", detail: item.userAgent, createdAt: item.createdAt, source: "tracking" })),
    ...payments.map((item) => ({ type: `payment.${item.eventType}`, detail: item.provider, createdAt: item.createdAt, source: "payment" })),
    ...messages.map((item) => ({ type: `automation.${item.channel}.${item.status}`, detail: item.subject || item.body.slice(0, 100), createdAt: item.createdAt, source: "automation" })),
    ...tasks.map((item) => ({ type: `task.${item.status}`, detail: item.title, createdAt: item.createdAt, source: item.source })),
  ];

  return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
