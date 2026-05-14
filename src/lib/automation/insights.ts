import { prisma } from "@/lib/prisma";

export async function getOperationalInsights(workspaceId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [hotLeads, proposalLikelyClose, underperformingSequences, outreachByType] = await Promise.all([
    prisma.lead.findMany({
      where: {
        workspaceId,
        status: { notIn: ["Won", "Lost"] },
        paymentLogs: { some: { createdAt: { gte: sevenDaysAgo } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, businessName: true },
    }),
    prisma.proposalDelivery.findMany({
      where: {
        workspaceId,
        openedAt: { not: null },
        acceptedAt: null,
      },
      orderBy: { openedAt: "desc" },
      take: 5,
      select: { id: true, lead: { select: { businessName: true } } },
    }),
    prisma.sequence.findMany({
      where: { workspaceId, status: "active" },
      include: {
        leadStates: true,
      },
      take: 20,
    }),
    prisma.outreachLog.groupBy({
      by: ["type"],
      where: { workspaceId, createdAt: { gte: sevenDaysAgo } },
      _count: { type: true },
    }),
  ]);

  const weakSequences = underperformingSequences
    .map((sequence) => {
      const total = sequence.leadStates.length;
      const completed = sequence.leadStates.filter((state) => state.status === "completed").length;
      const completionRate = total > 0 ? completed / total : 0;
      return { name: sequence.name, completionRate };
    })
    .filter((item) => item.completionRate < 0.2)
    .slice(0, 3);

  return {
    hotLeads: hotLeads.map((lead) => `Lead heating up: ${lead.businessName}`),
    proposalLikelyClose: proposalLikelyClose.map((item) => `Proposal likely to close: ${item.lead.businessName}`),
    weakSequences: weakSequences.map((sequence) => `Sequence underperforming: ${sequence.name}`),
    outreachMix: outreachByType.map((item) => `${item.type}: ${item._count.type}`),
  };
}
