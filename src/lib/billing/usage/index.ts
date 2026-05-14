import { prisma } from "@/lib/prisma";

export type UsageMetric =
  | "audits_generated"
  | "ai_generations"
  | "imported_leads"
  | "active_leads"
  | "outreach_generations"
  | "proposal_generations"
  | "storage_bytes"
  | "team_seats";

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export async function incrementUsageMetric(input: {
  workspaceId: string;
  metric: UsageMetric;
  amount?: number;
  metadata?: Record<string, unknown>;
}) {
  const periodStart = startOfMonth();
  const periodEnd = endOfMonth();
  const amount = Math.max(0, input.amount ?? 1);
  return prisma.usageRecord.upsert({
    where: {
      workspaceId_metric_periodStart: {
        workspaceId: input.workspaceId,
        metric: input.metric,
        periodStart,
      },
    },
    update: {
      quantity: { increment: amount },
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
      periodEnd,
    },
    create: {
      workspaceId: input.workspaceId,
      metric: input.metric,
      periodStart,
      periodEnd,
      quantity: amount,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function getWorkspaceUsage(workspaceId: string) {
  const periodStart = startOfMonth();
  const rows = await prisma.usageRecord.findMany({
    where: { workspaceId, periodStart },
  });
  return Object.fromEntries(rows.map((row) => [row.metric, row.quantity])) as Partial<Record<UsageMetric, number>>;
}

export async function setUsageMetric(input: {
  workspaceId: string;
  metric: UsageMetric;
  quantity: number;
}) {
  const periodStart = startOfMonth();
  const periodEnd = endOfMonth();
  return prisma.usageRecord.upsert({
    where: {
      workspaceId_metric_periodStart: {
        workspaceId: input.workspaceId,
        metric: input.metric,
        periodStart,
      },
    },
    update: {
      quantity: Math.max(0, input.quantity),
      periodEnd,
    },
    create: {
      workspaceId: input.workspaceId,
      metric: input.metric,
      periodStart,
      periodEnd,
      quantity: Math.max(0, input.quantity),
    },
  });
}
