import { ResearchQueueDashboard } from "@/components/research-queue-dashboard";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, withWorkspaceFallbackScope } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  const items = await prisma.researchQueueItem.findMany({
    where: withWorkspaceFallbackScope(workspaceId),
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <ResearchQueueDashboard
      items={items.map((item) => ({
        id: item.id,
        businessName: item.businessName,
        websiteUrl: item.websiteUrl,
        location: item.location,
        category: item.category,
        phone: item.phone,
        email: item.email,
        notes: item.notes,
        source: item.source,
        priority: item.priority,
        status: item.status,
        convertedLeadId: item.convertedLeadId,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }))}
    />
  );
}
