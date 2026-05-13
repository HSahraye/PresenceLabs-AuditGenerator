import { AuditDashboard } from "@/components/audit-dashboard";
import { requireRole } from "@/lib/auth";
import { buildSignedAuditPath } from "@/lib/audit-links";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireRole(["admin", "sales", "viewer"]);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);

  const leads = await prisma.lead.findMany({
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    include: {
      outreachLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      viewLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      attachedCaseStudy: true,
      paymentLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const viewCounts = await prisma.viewLog.groupBy({
    by: ["leadId"],
    _count: { leadId: true },
  });
  const todayOutreach = await prisma.outreachLog.groupBy({
    by: ["type"],
    where: { createdAt: { gte: startOfToday } },
    _count: { type: true },
  });
  const viewCountByLead = new Map(viewCounts.map((item) => [item.leadId, item._count.leadId]));
  const paymentCounts = await prisma.paymentLog.groupBy({
    by: ["leadId"],
    _count: { leadId: true },
  });
  const paymentCountByLead = new Map(paymentCounts.map((item) => [item.leadId, item._count.leadId]));
  const caseStudies = await prisma.caseStudy.findMany({ orderBy: [{ updatedAt: "desc" }] });
  const latestImportJob = await prisma.importJob.findFirst({
    where: { status: { in: ["Queued", "Running"] } },
    orderBy: { createdAt: "desc" },
  });
  const recentImportJobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const [queueDepth, failedJobsCount, eventsLast24h] = await Promise.all([
    prisma.importJob.count({ where: { status: { in: ["Queued", "Running"] } } }),
    prisma.importJob.count({ where: { status: "Failed" } }),
    prisma.eventLog.count({ where: { createdAt: { gte: last24Hours } } }),
  ]);

  return (
    <AuditDashboard
      latestImportJob={
        latestImportJob
          ? {
              id: latestImportJob.id,
              status: latestImportJob.status,
              mode: latestImportJob.mode,
              totalRows: latestImportJob.totalRows,
              processedRows: latestImportJob.processedRows,
              importedRows: latestImportJob.importedRows,
              skippedRows: latestImportJob.skippedRows,
              failedRows: latestImportJob.failedRows,
              errorSummary: latestImportJob.errorSummary,
              createdAt: latestImportJob.createdAt.toISOString(),
              startedAt: latestImportJob.startedAt?.toISOString() ?? null,
              completedAt: latestImportJob.completedAt?.toISOString() ?? null,
              updatedAt: latestImportJob.updatedAt.toISOString(),
            }
          : null
      }
      importJobs={recentImportJobs.map((job) => ({
        id: job.id,
        status: job.status,
        mode: job.mode,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        importedRows: job.importedRows,
        skippedRows: job.skippedRows,
        failedRows: job.failedRows,
        errorSummary: job.errorSummary,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString() ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
        updatedAt: job.updatedAt.toISOString(),
      }))}
      opsMetrics={{
        queueDepth,
        failedJobsCount,
        eventsLast24h,
      }}
      caseStudies={caseStudies.map((caseStudy) => ({
        id: caseStudy.id,
        title: caseStudy.title,
        result: caseStudy.result,
        description: caseStudy.description,
        imageUrl: caseStudy.imageUrl,
        category: caseStudy.category,
      }))}
      todayActivity={{
        calls: todayOutreach.find((item) => item.type === "Call")?._count.type ?? 0,
        sms: todayOutreach.filter((item) => item.type === "SMS").reduce((sum, item) => sum + item._count.type, 0),
        emails: todayOutreach.find((item) => item.type === "Email")?._count.type ?? 0,
      }}
      leads={leads.map((lead) => ({
        id: lead.id,
        businessName: lead.businessName,
        ownerName: lead.ownerName,
        category: lead.category,
        location: lead.location,
        websiteUrl: lead.websiteUrl,
        googleProfileUrl: lead.googleProfileUrl,
        phone: lead.phone,
        email: lead.email,
        notes: lead.notes,
        status: lead.status,
        score: lead.score,
        publicAuditPath: buildSignedAuditPath(lead.id),
        packageName: lead.packageName,
        customPrice: lead.customPrice,
        stripePaymentUrl: lead.stripePaymentUrl,
        attachedCaseStudyId: lead.attachedCaseStudyId,
        attachedCaseStudy: lead.attachedCaseStudy ? { id: lead.attachedCaseStudy.id, title: lead.attachedCaseStudy.title, result: lead.attachedCaseStudy.result, description: lead.attachedCaseStudy.description, imageUrl: lead.attachedCaseStudy.imageUrl, category: lead.attachedCaseStudy.category } : null,
        painSummary: lead.painSummary,
        auditJson: lead.auditJson,
        assetsJson: lead.assetsJson,
        nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
        lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
        outreachLogs: lead.outreachLogs.map((log) => ({ id: log.id, type: log.type, notes: log.notes, createdAt: log.createdAt.toISOString() })),
        viewCount: viewCountByLead.get(lead.id) ?? 0,
        lastViewedAt: lead.viewLogs[0]?.createdAt.toISOString() ?? null,
        paymentClickCount: paymentCountByLead.get(lead.id) ?? 0,
        lastPaymentClickedAt: lead.paymentLogs[0]?.createdAt.toISOString() ?? null,
        paymentStatus: lead.paymentStatus,
        lastPaymentAt: lead.lastPaymentAt?.toISOString() ?? null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }))}
    />
  );
}
