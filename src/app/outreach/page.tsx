import { OutreachView } from "@/components/outreach-view";
import { requireRole } from "@/lib/auth";
import { buildSignedAuditPath } from "@/lib/audit-links";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/url";
import { getWorkspaceContext, withWorkspaceFallbackScope } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  await requireRole(["admin", "sales", "viewer"]);
  const { workspaceId } = await getWorkspaceContext();
  const publicBaseUrl = getPublicBaseUrl();
  const now = new Date();
  const leads = await prisma.lead.findMany({
    where: {
      ...withWorkspaceFallbackScope(workspaceId),
      OR: [
        { status: "New" },
        { status: "Follow-up" },
        { nextFollowUpAt: { lte: now } },
      ],
      NOT: [{ status: "Won" }, { status: "Lost" }],
    },
    include: {
      viewLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      paymentLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  const viewCounts = await prisma.viewLog.groupBy({ by: ["leadId"], where: withWorkspaceFallbackScope(workspaceId), _count: { leadId: true } });
  const paymentCounts = await prisma.paymentLog.groupBy({ by: ["leadId"], where: withWorkspaceFallbackScope(workspaceId), _count: { leadId: true } });
  const viewCountByLead = new Map(viewCounts.map((item) => [item.leadId, item._count.leadId]));
  const paymentCountByLead = new Map(paymentCounts.map((item) => [item.leadId, item._count.leadId]));

  const mappedLeads = leads
    .map((lead) => ({
      id: lead.id,
      businessName: lead.businessName,
      ownerName: lead.ownerName,
      category: lead.category,
      location: lead.location,
      websiteUrl: lead.websiteUrl,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      score: lead.score,
      publicAuditPath: buildSignedAuditPath(lead.id),
      painSummary: lead.painSummary,
      assetsJson: lead.assetsJson,
      intelligenceJson: lead.intelligenceJson ?? null,
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
      lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
      viewCount: viewCountByLead.get(lead.id) ?? 0,
      lastViewedAt: lead.viewLogs[0]?.createdAt.toISOString() ?? null,
      paymentClickCount: paymentCountByLead.get(lead.id) ?? 0,
      lastPaymentClickedAt: lead.paymentLogs[0]?.createdAt.toISOString() ?? null,
    }))
    .sort((a, b) => {
      const aIntent = new Date(a.lastPaymentClickedAt ?? a.lastViewedAt ?? 0).getTime();
      const bIntent = new Date(b.lastPaymentClickedAt ?? b.lastViewedAt ?? 0).getTime();
      return bIntent - aIntent || b.score - a.score;
    });

  return <OutreachView leads={mappedLeads} publicBaseUrl={publicBaseUrl} />;
}
