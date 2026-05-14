import { prisma } from "@/lib/prisma";

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true },
  });
  for (const workspace of workspaces) {
    const existing = await prisma.workflowRule.count({
      where: { workspaceId: workspace.id },
    });
    if (existing > 0) continue;
    await prisma.workflowRule.createMany({
      data: [
        {
          workspaceId: workspace.id,
          name: "Payment intent clicked -> notify owner",
          triggerEvent: "payment_intent_clicked",
          status: "active",
          actionJson: JSON.stringify({
            actions: [
              { type: "notify_owner", title: "Lead clicked payment intent", body: "Payment-ready lead detected." },
              { type: "create_task", title: "Call payment-ready lead", dueMinutes: 30 },
            ],
          }),
        },
        {
          workspaceId: workspace.id,
          name: "Audit viewed -> follow-up task",
          triggerEvent: "audit_viewed",
          status: "active",
          actionJson: JSON.stringify({
            actions: [
              { type: "create_task", title: "Audit viewed follow-up", dueMinutes: 120 },
            ],
          }),
        },
        {
          workspaceId: workspace.id,
          name: "Proposal reopened -> escalate lead",
          triggerEvent: "proposal_reopened",
          status: "active",
          actionJson: JSON.stringify({
            actions: [
              { type: "escalate_lead" },
              { type: "create_task", title: "Proposal reopened - call now", dueMinutes: 30 },
            ],
          }),
        },
      ],
    });
  }
  console.log("Default automation workflow rules seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
