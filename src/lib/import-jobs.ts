import { prisma } from "@/lib/prisma";
import { pick } from "@/lib/csv";
import { generateAudit } from "@/lib/audit-engine";
import { logger } from "./logger";
import { trackEvent } from "./events";

const DEFAULT_CHUNK_SIZE = 3;
const RETRYABLE_IMPORT_ERRORS = [/429/, /rate limit/i, /timeout/i, /network/i, /5\d\d/];

function normalizeWebsiteKey(value?: string) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

type CsvRow = Record<string, string>;

export function serializeImportJob(job: {
  id: string;
  status: string;
  mode: string;
  totalRows: number;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  errorSummary: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}) {
  return {
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
  };
}

async function processRow(row: CsvRow, index: number) {
  const businessName = pick(row, ["business name", "name", "business", "company"]);
  const websiteUrl = pick(row, ["website", "website url", "url", "site"]);
  const websiteKey = normalizeWebsiteKey(websiteUrl);
  const location = pick(row, ["city", "location", "area"]);
  const ownerName = pick(row, ["owner", "owner name", "contact", "contact name"]);
  const category = pick(row, ["industry/category", "industry", "category", "type"]);
  const phone = pick(row, ["phone", "phone number", "mobile"]);
  const email = pick(row, ["email", "email address"]);
  const notes = pick(row, ["notes", "note", "description"]);

  if (!businessName && !websiteUrl) {
    return { kind: "failed" as const, error: `Row ${index + 2}: missing business name and website.` };
  }

  const candidates = await prisma.lead.findMany({
    where: {
      OR: [
        websiteUrl ? { websiteUrl: { contains: websiteKey || websiteUrl } } : undefined,
        businessName && location ? { AND: [{ businessName: { equals: businessName } }, { location }] } : undefined,
      ].filter(Boolean) as Array<{ websiteUrl?: { contains: string }; AND?: [{ businessName: { equals: string } }, { location: string }] }>,
    },
  });
  const existing = candidates.find(
    (lead) =>
      (websiteKey && normalizeWebsiteKey(lead.websiteUrl ?? "") === websiteKey) ||
      (businessName && location && lead.businessName === businessName && lead.location === location),
  );
  if (existing) {
    return { kind: "skipped" as const };
  }

  const audit = await generateAuditWithRetry({
    businessName: businessName || websiteUrl,
    ownerName,
    category,
    location,
    websiteUrl,
    notes,
  });
  await prisma.lead.create({
    data: {
      businessName: businessName || websiteUrl,
      ownerName: ownerName || null,
      category: category || null,
      location: location || null,
      websiteUrl: websiteUrl || null,
      googleProfileUrl: null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      status: "New",
      score: audit.assets.leadScore,
      packageName: audit.assets.recommendedPackage,
      painSummary: audit.assets.painPointSummary,
      auditJson: JSON.stringify({ checks: audit.checks, websiteSignals: audit.websiteSignals, warnings: audit.warnings, source: audit.source }, null, 2),
      assetsJson: JSON.stringify(audit.assets, null, 2),
    },
  });

  return { kind: "imported" as const };
}

async function generateAuditWithRetry(input: {
  businessName: string;
  ownerName?: string;
  category?: string;
  location?: string;
  websiteUrl?: string;
  notes?: string;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await generateAudit(input);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "unknown";
      const retryable = RETRYABLE_IMPORT_ERRORS.some((pattern) => pattern.test(message));
      if (!retryable || attempt === 2) break;
      const delayMs = 300 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function parsePayload(payloadJson: string) {
  const parsed = JSON.parse(payloadJson) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row): row is CsvRow => Boolean(row) && typeof row === "object");
}

export async function processImportJobChunk(jobId: string, chunkSize = DEFAULT_CHUNK_SIZE) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (job.status === "Completed" || job.status === "Failed") return job;
  if (job.cancelledAt) {
    return prisma.importJob.update({
      where: { id: job.id },
      data: { status: "Cancelled", completedAt: new Date() },
    });
  }
  if (job.nextRunAt && job.nextRunAt.getTime() > Date.now()) return job;

  const rows = parsePayload(job.payloadJson);
  const start = Math.max(0, job.processedRows);
  const end = Math.min(rows.length, start + Math.max(1, chunkSize));

  let importedRows = job.importedRows;
  let skippedRows = job.skippedRows;
  let failedRows = job.failedRows;
  const errors = job.errorSummary ? [job.errorSummary] : [];

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "Running",
      attempts: { increment: 1 },
      startedAt: job.startedAt ?? new Date(),
    },
  });

  for (let index = start; index < end; index += 1) {
    try {
      const result = await processRow(rows[index] ?? {}, index);
      if (result.kind === "imported") importedRows += 1;
      if (result.kind === "skipped") skippedRows += 1;
      if (result.kind === "failed") {
        failedRows += 1;
        errors.push(result.error);
      }
    } catch (error) {
      failedRows += 1;
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "import failed"}`);
    }
  }

  const processedRows = end;
  const isDone = processedRows >= rows.length;
  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: isDone ? "Completed" : "Running",
      processedRows,
      importedRows,
      skippedRows,
      failedRows,
      errorSummary: errors.filter(Boolean).slice(0, 3).join(" "),
      completedAt: isDone ? new Date() : null,
      nextRunAt: isDone ? null : new Date(Date.now() + 350),
      lastErrorAt: errors.length ? new Date() : null,
    },
  });
  if (updated.status === "Completed") {
    await trackEvent("import_job_completed", {
      jobId: updated.id,
      totalRows: updated.totalRows,
      importedRows: updated.importedRows,
      skippedRows: updated.skippedRows,
      failedRows: updated.failedRows,
    });
  }
  return updated;
}

export async function cancelImportJob(jobId: string) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: {
      cancelledAt: new Date(),
      status: "Cancelled",
      completedAt: new Date(),
    },
  });
}

export async function retryImportJob(jobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (job.attempts >= job.maxAttempts) {
    logger.warn("import_job_retry_limit_reached", { jobId, attempts: job.attempts, maxAttempts: job.maxAttempts });
    return job;
  }
  return prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: "Queued",
      nextRunAt: new Date(),
      cancelledAt: null,
      completedAt: null,
    },
  });
}

export async function listRecentImportJobs(limit = 10) {
  return prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 50)),
  });
}
