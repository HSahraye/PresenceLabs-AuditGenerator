import { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, PLAN_DISPLAY } from "@/lib/billing/plans";

async function main() {
  const existing = await prisma.plan.count({
    where: { workspaceId: null },
  });
  if (existing > 0) {
    console.log("Global plans already exist. Skipping.");
    return;
  }
  for (const tier of Object.keys(PLAN_LIMITS) as PlanTier[]) {
    await prisma.plan.create({
      data: {
        workspaceId: null,
        tier,
        name: PLAN_DISPLAY[tier].label,
        monthlyPriceCents: PLAN_DISPLAY[tier].monthlyPriceCents,
        yearlyPriceCents: PLAN_DISPLAY[tier].monthlyPriceCents * 10,
        limitsJson: JSON.stringify(PLAN_LIMITS[tier]),
      },
    });
  }
  console.log("Created default SaaS plans.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
