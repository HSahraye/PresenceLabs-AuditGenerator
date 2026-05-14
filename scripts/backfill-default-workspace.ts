import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.DEFAULT_WORKSPACE_SLUG?.trim() || "default";
  const name = process.env.DEFAULT_WORKSPACE_NAME?.trim() || "Default Workspace";
  const ownerEmail = process.env.DEFAULT_OWNER_EMAIL?.trim().toLowerCase();
  const ownerName = process.env.DEFAULT_OWNER_NAME?.trim() || "Owner";

  const workspace = await prisma.workspace.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });

  const updates = await Promise.all([
    prisma.lead.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.outreachLog.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.viewLog.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.paymentLog.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.caseStudy.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.researchQueueItem.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.importJob.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.auditLog.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.eventLog.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.webhookEvent.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
  ]);

  if (ownerEmail) {
    const user = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { name: ownerName },
      create: { email: ownerEmail, name: ownerName },
    });
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: { role: "owner" },
      create: { userId: user.id, workspaceId: workspace.id, role: "owner" },
    });
  }

  const total = updates.reduce((sum, item) => sum + item.count, 0);
  console.log(`Backfilled workspace ${workspace.slug} (${workspace.id}) across ${total} rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
