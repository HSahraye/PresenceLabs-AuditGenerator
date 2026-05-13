"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateAudit } from "@/lib/audit-engine";
import { parseCsv, pick } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

const queueStatuses = ["Queued", "Researching", "Audited", "Converted", "Skipped"] as const;

const queueItemSchema = z.object({
  businessName: z.string().min(1),
  websiteUrl: z.string().optional(),
  location: z.string().optional(),
  category: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(5).default(3),
});

const queueStatusSchema = z.object({ id: z.string().min(1), status: z.enum(queueStatuses) });

function parseLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*[|\t]\s*/);
      if (parts.length > 1) {
        return {
          businessName: parts[0] ?? "",
          websiteUrl: parts[1] ?? "",
          location: parts[2] ?? "",
          category: parts[3] ?? "",
          phone: parts[4] ?? "",
          email: parts[5] ?? "",
          notes: parts.slice(6).join(" | "),
        };
      }
      return { businessName: line, notes: "Manual research queue paste" };
    });
}

function normalizeWebsite(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

export async function addResearchQueueItemsAction(_prevState: unknown, formData: FormData) {
  const rawText = String(formData.get("items") ?? "");
  const source = String(formData.get("source") ?? "manual paste");
  const priority = Number(formData.get("priority") ?? 3);
  if (!rawText.trim()) return { ok: false, added: 0, skipped: 0, error: "Paste business names, pipe-separated rows, or CSV data first." };

  const looksLikeCsv = rawText.split(/\r?\n/)[0]?.includes(",");
  const rows = looksLikeCsv
    ? parseCsv(rawText).map((row) => ({
        businessName: pick(row, ["business name", "name", "business", "company"]),
        websiteUrl: pick(row, ["website", "website url", "url", "site"]),
        location: pick(row, ["city", "location", "area"]),
        category: pick(row, ["industry/category", "industry", "category", "type"]),
        phone: pick(row, ["phone", "phone number", "mobile"]),
        email: pick(row, ["email", "email address"]),
        notes: pick(row, ["notes", "note", "description"]),
      }))
    : parseLines(rawText);

  let added = 0;
  let skipped = 0;

  for (const row of rows) {
    const parsed = queueItemSchema.safeParse({ ...row, source, priority });
    if (!parsed.success) {
      skipped += 1;
      continue;
    }

    const websiteKey = normalizeWebsite(parsed.data.websiteUrl);
    const existing = await prisma.researchQueueItem.findFirst({
      where: {
        OR: [
          websiteKey ? { websiteUrl: { contains: websiteKey } } : undefined,
          parsed.data.location ? { AND: [{ businessName: parsed.data.businessName }, { location: parsed.data.location }] } : { businessName: parsed.data.businessName },
        ].filter(Boolean) as Array<{ websiteUrl?: { contains: string }; businessName?: string; AND?: [{ businessName: string }, { location: string }] }>,
      },
    });

    if (existing && (!websiteKey || normalizeWebsite(existing.websiteUrl) === websiteKey || existing.businessName === parsed.data.businessName)) {
      skipped += 1;
      continue;
    }

    await prisma.researchQueueItem.create({
      data: {
        ...parsed.data,
        websiteUrl: parsed.data.websiteUrl || null,
        location: parsed.data.location || null,
        category: parsed.data.category || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
        source: parsed.data.source || null,
      },
    });
    added += 1;
  }

  revalidatePath("/research");
  return { ok: true, added, skipped, error: "" };
}

export async function updateResearchQueueStatusAction(id: string, status: string) {
  const parsed = queueStatusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Invalid queue status." };
  await prisma.researchQueueItem.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
  revalidatePath("/research");
  return { ok: true };
}

export async function convertQueueItemToLeadAction(id: string) {
  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid queue item." };

  const item = await prisma.researchQueueItem.findUnique({ where: { id: parsed.data } });
  if (!item) return { ok: false, error: "Queue item not found." };

  const existingLead = await prisma.lead.findFirst({
    where: {
      OR: [
        item.websiteUrl ? { websiteUrl: item.websiteUrl } : undefined,
        item.location ? { AND: [{ businessName: item.businessName }, { location: item.location }] } : { businessName: item.businessName },
      ].filter(Boolean) as Array<{ websiteUrl?: string; businessName?: string; AND?: [{ businessName: string }, { location: string }] }>,
    },
  });
  if (existingLead) {
    await prisma.researchQueueItem.update({ where: { id: item.id }, data: { status: "Converted", convertedLeadId: existingLead.id } });
    revalidatePath("/research");
    return { ok: true, leadId: existingLead.id, reused: true };
  }

  const audit = await generateAudit({
    businessName: item.businessName,
    category: item.category ?? undefined,
    location: item.location ?? undefined,
    websiteUrl: item.websiteUrl ?? undefined,
    notes: item.notes ?? undefined,
  });

  const lead = await prisma.lead.create({
    data: {
      businessName: item.businessName,
      category: item.category,
      location: item.location,
      websiteUrl: item.websiteUrl,
      googleProfileUrl: null,
      phone: item.phone,
      email: item.email,
      notes: item.notes,
      status: "New",
      score: audit.assets.leadScore,
      packageName: audit.assets.recommendedPackage,
      painSummary: audit.assets.painPointSummary,
      auditJson: JSON.stringify({ checks: audit.checks, websiteSignals: audit.websiteSignals, warnings: audit.warnings, source: audit.source }, null, 2),
      assetsJson: JSON.stringify(audit.assets, null, 2),
    },
  });

  await prisma.researchQueueItem.update({ where: { id: item.id }, data: { status: "Converted", convertedLeadId: lead.id } });
  revalidatePath("/");
  revalidatePath("/research");
  return { ok: true, leadId: lead.id, reused: false };
}
