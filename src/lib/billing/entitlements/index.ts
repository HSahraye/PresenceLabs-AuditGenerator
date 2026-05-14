import type { PlanTier } from "@prisma/client";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { getWorkspaceUsage, type UsageMetric } from "@/lib/billing/usage";
import { prisma } from "@/lib/prisma";

export type EntitlementResult = {
  allowed: boolean;
  reason?: string;
  limit: number;
  used: number;
  remaining: number;
};

export async function getWorkspacePlanTier(workspaceId: string): Promise<PlanTier> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { planTier: true, status: true },
  });
  return workspace?.planTier || "free_trial";
}

export async function ensureWorkspaceOperational(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { status: true, trialEndsAt: true },
  });
  if (!workspace) {
    return { ok: false as const, reason: "Workspace not found." };
  }
  if (workspace.status === "suspended" || workspace.status === "canceled") {
    return { ok: false as const, reason: "Workspace is read-only. Contact support to reactivate." };
  }
  if (workspace.status === "delinquent") {
    return { ok: false as const, reason: "Billing issue detected. Update payment method to continue generation." };
  }
  if (workspace.status === "trialing" && workspace.trialEndsAt && workspace.trialEndsAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "Trial expired. Choose a paid plan to continue." };
  }
  return { ok: true as const };
}

async function checkLimit(
  workspaceId: string,
  key: keyof typeof PLAN_LIMITS["free_trial"],
  metric: UsageMetric,
) {
  const tier = await getWorkspacePlanTier(workspaceId);
  const usage = await getWorkspaceUsage(workspaceId);
  const limit = PLAN_LIMITS[tier][key];
  const used = usage[metric] ?? 0;
  return {
    allowed: used < limit,
    reason: used < limit ? undefined : `Usage limit reached for ${metric}.`,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  } satisfies EntitlementResult;
}

export async function enforceAuditGeneration(workspaceId: string) {
  return checkLimit(workspaceId, "auditsPerMonth", "audits_generated");
}

export async function enforceImportLimit(workspaceId: string) {
  return checkLimit(workspaceId, "importsPerMonth", "imported_leads");
}

export async function enforceTemplateLimit(workspaceId: string) {
  const tier = await getWorkspacePlanTier(workspaceId);
  const limit = PLAN_LIMITS[tier].templates;
  const [auditCount, outreachCount, offerCount] = await Promise.all([
    prisma.auditTemplate.count({ where: { workspaceId, archived: false } }),
    prisma.outreachTemplate.count({ where: { workspaceId, archived: false } }),
    prisma.offerTemplate.count({ where: { workspaceId, archived: false } }),
  ]);
  const used = auditCount + outreachCount + offerCount;
  return {
    allowed: used < limit,
    reason: used < limit ? undefined : "Template limit reached for this plan.",
    limit,
    used,
    remaining: Math.max(0, limit - used),
  } satisfies EntitlementResult;
}

export async function enforceSeatLimit(workspaceId: string) {
  const tier = await getWorkspacePlanTier(workspaceId);
  const limit = PLAN_LIMITS[tier].seats;
  const used = await prisma.membership.count({ where: { workspaceId } });
  return {
    allowed: used < limit,
    reason: used < limit ? undefined : "Seat limit reached for this plan.",
    limit,
    used,
    remaining: Math.max(0, limit - used),
  } satisfies EntitlementResult;
}
