"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspaceRole } from "@/lib/auth";
import { enforceTemplateLimit } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/prisma";
import {
  SYSTEM_DEFAULT_AUDIT_TEMPLATES,
  SYSTEM_DEFAULT_OFFER_TEMPLATE,
  SYSTEM_DEFAULT_OUTREACH_TEMPLATE,
} from "@/lib/templates/defaults";
import {
  AuditTemplateConfigSchema,
  OfferTemplateConfigSchema,
  OutreachTemplateConfigSchema,
  type TemplateKind,
} from "@/lib/templates";

const kindSchema = z.enum(["audit", "outreach", "offer"]);

const saveTemplateSchema = z.object({
  id: z.string().optional(),
  kind: kindSchema,
  name: z.string().min(2).max(120),
  category: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  contentJson: z.string().min(2),
});

const mutationSchema = z.object({
  id: z.string().min(1),
  kind: kindSchema,
});

function parseTemplateConfig(kind: TemplateKind, contentJson: string) {
  const parsed = JSON.parse(contentJson) as unknown;
  if (kind === "audit") return AuditTemplateConfigSchema.parse(parsed);
  if (kind === "outreach") return OutreachTemplateConfigSchema.parse(parsed);
  return OfferTemplateConfigSchema.parse(parsed);
}

function normalizeCategory(value?: string) {
  const category = value?.trim();
  return category ? category.toLowerCase() : null;
}

async function clearDefaults(workspaceId: string, kind: TemplateKind) {
  if (kind === "audit") {
    await prisma.auditTemplate.updateMany({ where: { workspaceId, isDefault: true }, data: { isDefault: false } });
    return;
  }
  if (kind === "outreach") {
    await prisma.outreachTemplate.updateMany({ where: { workspaceId, isDefault: true }, data: { isDefault: false } });
    return;
  }
  await prisma.offerTemplate.updateMany({ where: { workspaceId, isDefault: true }, data: { isDefault: false } });
}

export async function listTemplatesAction(kind: TemplateKind) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  if (kind === "audit") {
    return prisma.auditTemplate.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
  }
  if (kind === "outreach") {
    return prisma.outreachTemplate.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
  }
  return prisma.offerTemplate.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function saveTemplateAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const isActive = formData.has("isActive");
  const isDefault = formData.has("isDefault");
  const parsed = saveTemplateSchema.safeParse({
    id: formData.get("id") || undefined,
    kind: formData.get("kind"),
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    isActive,
    isDefault,
    contentJson: formData.get("contentJson"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid template payload." };
  if (!parsed.data.id) {
    const entitlement = await enforceTemplateLimit(session.workspaceId);
    if (!entitlement.allowed) {
      return { ok: false, error: entitlement.reason || "Template limit reached for this billing plan." };
    }
  }

  let normalized: unknown;
  try {
    normalized = parseTemplateConfig(parsed.data.kind, parsed.data.contentJson);
  } catch {
    return { ok: false, error: "Template config is malformed." };
  }

  if (parsed.data.isDefault) {
    await clearDefaults(session.workspaceId, parsed.data.kind);
  }

  const payload = {
    workspaceId: session.workspaceId,
    name: parsed.data.name,
    category: normalizeCategory(parsed.data.category),
    isActive: parsed.data.isActive ?? true,
    isDefault: parsed.data.isDefault ?? false,
    contentJson: JSON.stringify(normalized, null, 2),
  };

  if (parsed.data.kind === "audit") {
    if (parsed.data.id) {
      await prisma.auditTemplate.update({
        where: { id: parsed.data.id },
        data: { ...payload, version: { increment: 1 } },
      });
    } else {
      await prisma.auditTemplate.create({ data: payload });
    }
  } else if (parsed.data.kind === "outreach") {
    if (parsed.data.id) {
      await prisma.outreachTemplate.update({
        where: { id: parsed.data.id },
        data: { ...payload, version: { increment: 1 } },
      });
    } else {
      await prisma.outreachTemplate.create({ data: payload });
    }
  } else if (parsed.data.id) {
    await prisma.offerTemplate.update({
      where: { id: parsed.data.id },
      data: { ...payload, version: { increment: 1 } },
    });
  } else {
    await prisma.offerTemplate.create({ data: payload });
  }

  revalidatePath("/templates");
  return { ok: true };
}

export async function duplicateTemplateAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const parsed = mutationSchema.safeParse({
    id: formData.get("id"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid duplication request." };

  if (parsed.data.kind === "audit") {
    const current = await prisma.auditTemplate.findUnique({ where: { id: parsed.data.id } });
    if (!current) return { ok: false, error: "Template not found." };
    await prisma.auditTemplate.create({
      data: {
        workspaceId: session.workspaceId,
        name: `${current.name} (Copy)`,
        category: current.category,
        contentJson: current.contentJson,
        isActive: current.isActive,
        isDefault: false,
      },
    });
  } else if (parsed.data.kind === "outreach") {
    const current = await prisma.outreachTemplate.findUnique({ where: { id: parsed.data.id } });
    if (!current) return { ok: false, error: "Template not found." };
    await prisma.outreachTemplate.create({
      data: {
        workspaceId: session.workspaceId,
        name: `${current.name} (Copy)`,
        category: current.category,
        contentJson: current.contentJson,
        isActive: current.isActive,
        isDefault: false,
      },
    });
  } else {
    const current = await prisma.offerTemplate.findUnique({ where: { id: parsed.data.id } });
    if (!current) return { ok: false, error: "Template not found." };
    await prisma.offerTemplate.create({
      data: {
        workspaceId: session.workspaceId,
        name: `${current.name} (Copy)`,
        category: current.category,
        contentJson: current.contentJson,
        isActive: current.isActive,
        isDefault: false,
      },
    });
  }

  revalidatePath("/templates");
  return { ok: true };
}

export async function archiveTemplateAction(formData: FormData) {
  await requireWorkspaceRole(["owner", "admin"]);
  const parsed = mutationSchema.safeParse({
    id: formData.get("id"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid archive request." };
  if (parsed.data.kind === "audit") {
    await prisma.auditTemplate.update({ where: { id: parsed.data.id }, data: { archived: true, isActive: false, isDefault: false } });
  } else if (parsed.data.kind === "outreach") {
    await prisma.outreachTemplate.update({ where: { id: parsed.data.id }, data: { archived: true, isActive: false, isDefault: false } });
  } else {
    await prisma.offerTemplate.update({ where: { id: parsed.data.id }, data: { archived: true, isActive: false, isDefault: false } });
  }
  revalidatePath("/templates");
  return { ok: true };
}

export async function seedSystemTemplatesAction() {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const existingAudit = await prisma.auditTemplate.count({ where: { workspaceId: session.workspaceId } });
  if (existingAudit > 0) {
    return { ok: false, error: "Templates already exist for this workspace." };
  }

  const auditCreates = Object.entries(SYSTEM_DEFAULT_AUDIT_TEMPLATES).map(([name, config], index) =>
    prisma.auditTemplate.create({
      data: {
        workspaceId: session.workspaceId,
        name,
        isDefault: index === 0,
        isActive: true,
        contentJson: JSON.stringify(config, null, 2),
      },
    }));

  await prisma.$transaction([
    ...auditCreates,
    prisma.outreachTemplate.create({
      data: {
        workspaceId: session.workspaceId,
        name: "General Growth Outreach",
        isDefault: true,
        isActive: true,
        contentJson: JSON.stringify(SYSTEM_DEFAULT_OUTREACH_TEMPLATE, null, 2),
      },
    }),
    prisma.offerTemplate.create({
      data: {
        workspaceId: session.workspaceId,
        name: "General Growth Proposal",
        isDefault: true,
        isActive: true,
        contentJson: JSON.stringify(SYSTEM_DEFAULT_OFFER_TEMPLATE, null, 2),
      },
    }),
  ]);

  revalidatePath("/templates");
  return { ok: true };
}
