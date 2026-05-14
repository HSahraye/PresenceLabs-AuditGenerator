import { prisma } from "@/lib/prisma";

export type OnboardingMilestoneKey =
  | "first_audit_generated"
  | "first_import_completed"
  | "first_outreach_generated"
  | "first_payment_link_sent";

const ORDER: OnboardingMilestoneKey[] = [
  "first_audit_generated",
  "first_import_completed",
  "first_outreach_generated",
  "first_payment_link_sent",
];

export async function markOnboardingMilestone(workspaceId: string, key: OnboardingMilestoneKey, metadata?: Record<string, unknown>) {
  const now = new Date();
  await prisma.onboardingMilestone.upsert({
    where: { workspaceId_key: { workspaceId, key } },
    update: {
      completedAt: now,
      metadataJson: metadata ? JSON.stringify(metadata) : undefined,
    },
    create: {
      workspaceId,
      key,
      completedAt: now,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    },
  });

  const completed = await prisma.onboardingMilestone.count({
    where: { workspaceId, completedAt: { not: null } },
  });
  if (completed >= ORDER.length) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { onboardingCompletedAt: now, activatedAt: now },
    });
  }
}

export async function getOnboardingProgress(workspaceId: string) {
  const rows = await prisma.onboardingMilestone.findMany({
    where: { workspaceId },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.completedAt]));
  const completed = ORDER.filter((key) => Boolean(byKey.get(key))).length;
  return {
    completed,
    total: ORDER.length,
    items: ORDER.map((key) => ({
      key,
      completedAt: byKey.get(key) ?? null,
    })),
  };
}
