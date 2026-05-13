"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateAudit } from "@/lib/audit-engine";
import { parseCsv, pick } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

const leadStatuses = ["New", "Contacted", "Follow-up", "Won", "Lost"] as const;

const formSchema = z.object({
  businessName: z.string().min(1, "Business name is required."),
  ownerName: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().optional(),
  googleProfileUrl: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
});

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(leadStatuses),
});

const notesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().max(4000).optional(),
});

const offerSchema = z.object({
  id: z.string().min(1),
  packageName: z.string().min(1).max(200),
  customPrice: z.coerce.number().int().min(0).max(100000).optional(),
  attachedCaseStudyId: z.string().optional(),
  stripePaymentUrl: z.string().url().optional().or(z.literal("")),
});

const outreachSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["Email", "Call", "SMS", "Share", "Note"]),
  notes: z.string().max(2000).optional(),
  nextFollowUpAt: z.string().optional(),
});

function normalizeWebsiteKey(value?: string) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export async function createLeadAction(_prevState: unknown, formData: FormData) {
  const parsed = formSchema.safeParse({
    businessName: formData.get("businessName"),
    ownerName: formData.get("ownerName"),
    category: formData.get("category"),
    location: formData.get("location"),
    websiteUrl: formData.get("websiteUrl"),
    googleProfileUrl: formData.get("googleProfileUrl"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const audit = await generateAudit(parsed.data);

  const lead = await prisma.lead.create({
    data: {
      ...parsed.data,
      ownerName: parsed.data.ownerName || null,
      websiteUrl: parsed.data.websiteUrl || null,
      googleProfileUrl: parsed.data.googleProfileUrl || null,
      category: parsed.data.category || null,
      location: parsed.data.location || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
      status: "New",
      score: audit.assets.leadScore,
      packageName: audit.assets.recommendedPackage,
      painSummary: audit.assets.painPointSummary,
      auditJson: JSON.stringify({ checks: audit.checks, websiteSignals: audit.websiteSignals, warnings: audit.warnings, source: audit.source }, null, 2),
      assetsJson: JSON.stringify(audit.assets, null, 2),
    },
  });

  revalidatePath("/");
  return { ok: true, leadId: lead.id };
}

export async function updateLeadStatusAction(id: string, status: string) {
  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Invalid lead status update." };

  await prisma.lead.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  revalidatePath("/");
  revalidatePath(`/audit/${parsed.data.id}`);
  return { ok: true };
}

export async function updateLeadOfferAction(_prevState: unknown, formData: FormData) {
  const parsed = offerSchema.safeParse({
    id: formData.get("id"),
    packageName: formData.get("packageName"),
    customPrice: formData.get("customPrice") || undefined,
    attachedCaseStudyId: formData.get("attachedCaseStudyId") || undefined,
    stripePaymentUrl: formData.get("stripePaymentUrl") || "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid offer update.", leadId: "" };

  await prisma.lead.update({
    where: { id: parsed.data.id },
    data: {
      packageName: parsed.data.packageName,
      customPrice: parsed.data.customPrice && parsed.data.customPrice > 0 ? parsed.data.customPrice : null,
      attachedCaseStudyId: parsed.data.attachedCaseStudyId || null,
      stripePaymentUrl: parsed.data.stripePaymentUrl || null,
    },
  });

  revalidatePath("/");
  revalidatePath(`/audit/${parsed.data.id}`);
  return { ok: true, leadId: parsed.data.id };
}

export async function updateLeadNotesAction(formData: FormData) {
  const parsed = notesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid notes update." };

  await prisma.lead.update({
    where: { id: parsed.data.id },
    data: { notes: parsed.data.notes || null },
  });

  revalidatePath("/");
  revalidatePath(`/audit/${parsed.data.id}`);
  return { ok: true, leadId: parsed.data.id };
}

export async function logOutreachAction(id: string, type: "Email" | "Call" | "SMS" | "Share" | "Note", notes?: string, nextFollowUpAt?: string) {
  const parsed = outreachSchema.safeParse({ id, type, notes, nextFollowUpAt });
  if (!parsed.success) return { ok: false, error: "Invalid outreach log." };

  const followUpDate = parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null;
  await prisma.$transaction([
    prisma.outreachLog.create({
      data: {
        leadId: parsed.data.id,
        type: parsed.data.type,
        notes: parsed.data.notes || null,
      },
    }),
    prisma.lead.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.type === "Note" ? undefined : "Contacted",
        lastContactedAt: parsed.data.type === "Note" ? undefined : new Date(),
        nextFollowUpAt: followUpDate && !Number.isNaN(followUpDate.getTime()) ? followUpDate : undefined,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/call-today");
  return { ok: true };
}

export async function regenerateLeadAction(id: string, notes?: string) {
  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid lead id." };

  const parsedNotes = z.string().max(4000).optional().safeParse(notes);
  if (!parsedNotes.success) return { ok: false, error: "Notes are too long." };

  const lead = await prisma.lead.findUnique({ where: { id: parsed.data } });
  if (!lead) return { ok: false, error: "Lead not found." };

  const currentNotes = parsedNotes.data ?? lead.notes ?? undefined;
  const audit = await generateAudit({
    businessName: lead.businessName,
    ownerName: lead.ownerName ?? undefined,
    category: lead.category ?? undefined,
    location: lead.location ?? undefined,
    websiteUrl: lead.websiteUrl ?? undefined,
    googleProfileUrl: lead.googleProfileUrl ?? undefined,
    notes: currentNotes,
  });

  await prisma.lead.update({
    where: { id: parsed.data },
    data: {
      notes: currentNotes ?? null,
      score: audit.assets.leadScore,
      packageName: audit.assets.recommendedPackage,
      painSummary: audit.assets.painPointSummary,
      auditJson: JSON.stringify({ checks: audit.checks, websiteSignals: audit.websiteSignals, warnings: audit.warnings, source: audit.source }, null, 2),
      assetsJson: JSON.stringify(audit.assets, null, 2),
    },
  });

  revalidatePath("/");
  revalidatePath(`/audit/${parsed.data}`);
  return { ok: true };
}

export async function importLeadsCsvAction(_prevState: unknown, formData: FormData) {
  const pastedCsv = String(formData.get("csvText") ?? "");
  const file = formData.get("csvFile");
  const fileCsv = file instanceof File && file.size > 0 ? await file.text() : "";
  const csvText = fileCsv || pastedCsv;

  if (!csvText.trim()) return { ok: false, imported: 0, skipped: 0, failed: 0, error: "Paste or upload CSV data first." };

  const rows = parseCsv(csvText);
  if (!rows.length) return { ok: false, imported: 0, skipped: 0, failed: 0, error: "No valid CSV rows found." };

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
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
      failed += 1;
      errors.push(`Row ${index + 2}: missing business name and website.`);
      continue;
    }

    const candidates = await prisma.lead.findMany({
      where: {
        OR: [
          websiteUrl ? { websiteUrl: { contains: websiteKey || websiteUrl } } : undefined,
          businessName && location ? { AND: [{ businessName: { equals: businessName } }, { location }] } : undefined,
        ].filter(Boolean) as Array<{ websiteUrl?: { contains: string }; AND?: [{ businessName: { equals: string } }, { location: string }] }>,
      },
    });
    const existing = candidates.find((lead) => (websiteKey && normalizeWebsiteKey(lead.websiteUrl ?? "") === websiteKey) || (businessName && location && lead.businessName === businessName && lead.location === location));

    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      const audit = await generateAudit({ businessName: businessName || websiteUrl, ownerName, category, location, websiteUrl, notes });
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
      imported += 1;
    } catch (error) {
      failed += 1;
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "import failed"}`);
    }
  }

  revalidatePath("/");
  return { ok: true, imported, skipped, failed, error: errors.slice(0, 3).join(" ") };
}

export async function deleteLeadAction(id: string) {
  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid lead id." };

  await prisma.lead.delete({ where: { id: parsed.data } });
  revalidatePath("/");
  return { ok: true };
}
