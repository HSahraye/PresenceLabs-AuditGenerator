"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SequenceChannel } from "@prisma/client";
import { requireWorkspaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSequence, startLeadSequence } from "@/lib/automation/outreach/sequences";
import { applyPlaybookToLead, createPlaybook } from "@/lib/automation/playbooks";
import { processOutboundQueue } from "@/lib/automation/outreach";
import { runFollowupAutomation } from "@/lib/automation/outreach/followup";
import { enqueueProposalReminder, sendProposal } from "@/lib/automation/proposals";
import { validateSequenceSteps, type SequenceStepInput } from "@/lib/automation/outreach/validation";

const createSequenceSchema = z.object({
  name: z.string().min(2),
  category: z.string().optional(),
  stepsJson: z.string().min(2),
  autoMode: z.enum(["auto_draft", "approval_required", "auto_send"]).optional(),
});

const startSequenceSchema = z.object({
  sequenceId: z.string().min(1),
  leadId: z.string().min(1),
  scheduledStartAt: z.string().optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(2),
  triggerEvent: z.string().min(2),
  conditionJson: z.string().optional(),
  actionJson: z.string().min(2),
});

const updateSequenceSchema = z.object({
  sequenceId: z.string().min(1),
  name: z.string().min(2),
  category: z.string().optional(),
  status: z.enum(["active", "paused", "archived"]),
  autoMode: z.enum(["auto_draft", "approval_required", "auto_send"]),
  stepsJson: z.string().min(2),
});

function parseSequenceStepsJson(raw: string): SequenceStepInput[] | null {
  try {
    const parsed = JSON.parse(raw) as Array<{
      id?: string;
      name?: string;
      channel?: string;
      delayMinutes?: number;
      contentTemplate?: string;
      approvalRequired?: boolean;
      subject?: string;
      metadata?: Record<string, unknown>;
    }>;
    return parsed.map((step) => ({
      id: step.id,
      name: String(step.name || ""),
      channel: (step.channel || "email") as SequenceChannel,
      delayMinutes: Number(step.delayMinutes || 0),
      contentTemplate: String(step.contentTemplate || ""),
      approvalRequired: step.approvalRequired ?? true,
      subject: step.subject ? String(step.subject) : undefined,
      metadata: step.metadata || undefined,
    }));
  } catch {
    return null;
  }
}

export async function createSequenceAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const parsed = createSequenceSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    stepsJson: formData.get("stepsJson"),
    autoMode: formData.get("autoMode") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid sequence payload." };
  const steps = parseSequenceStepsJson(parsed.data.stepsJson);
  if (!steps) return { ok: false, error: "Invalid steps JSON." };
  const validation = validateSequenceSteps(steps);
  if (!validation.ok) return { ok: false, error: validation.error };
  let sequence: { id: string };
  try {
    sequence = await createSequence({
      workspaceId: session.workspaceId,
      name: parsed.data.name,
      category: parsed.data.category,
      steps,
      autoMode: parsed.data.autoMode,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create sequence." };
  }
  revalidatePath("/");
  revalidatePath("/sequences");
  return { ok: true, sequenceId: sequence.id };
}

export async function startLeadSequenceAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const parsed = startSequenceSchema.safeParse({
    sequenceId: formData.get("sequenceId"),
    leadId: formData.get("leadId"),
    scheduledStartAt: formData.get("scheduledStartAt") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const scheduledStartAt = parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt) : undefined;
  if (scheduledStartAt && Number.isNaN(scheduledStartAt.getTime())) return { ok: false, error: "Invalid schedule date." };
  const result = await startLeadSequence({
    workspaceId: session.workspaceId,
    sequenceId: parsed.data.sequenceId,
    leadId: parsed.data.leadId,
    scheduledStartAt,
  });
  if (!result.ok) return result;
  revalidatePath("/");
  revalidatePath(`/prep/${parsed.data.leadId}`);
  revalidatePath("/sequences");
  return { ok: true };
}

export async function saveSequenceBuilderAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const parsed = updateSequenceSchema.safeParse({
    sequenceId: formData.get("sequenceId"),
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    status: formData.get("status"),
    autoMode: formData.get("autoMode"),
    stepsJson: formData.get("stepsJson"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid sequence form payload." };
  const steps = parseSequenceStepsJson(parsed.data.stepsJson);
  if (!steps) return { ok: false, error: "Steps JSON is malformed." };
  const validation = validateSequenceSteps(steps);
  if (!validation.ok) return { ok: false, error: validation.error };

  const existing = await prisma.sequence.findFirst({
    where: { id: parsed.data.sequenceId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Sequence not found." };

  await prisma.$transaction(async (tx) => {
    await tx.sequence.update({
      where: { id: parsed.data.sequenceId },
      data: {
        name: parsed.data.name,
        category: parsed.data.category || null,
        status: parsed.data.status,
        autoMode: parsed.data.autoMode,
      },
    });
    await tx.sequenceStep.deleteMany({ where: { sequenceId: parsed.data.sequenceId } });
    if (steps.length) {
      await tx.sequenceStep.createMany({
        data: steps.map((step, index) => ({
          sequenceId: parsed.data.sequenceId,
          stepOrder: index,
          name: step.name,
          channel: step.channel,
          delayMinutes: step.delayMinutes ?? 0,
          contentTemplate: step.contentTemplate || null,
          approvalRequired: step.approvalRequired ?? true,
          conditionJson:
            step.subject || step.metadata
              ? JSON.stringify({
                  subject: step.subject || null,
                  metadata: step.metadata || null,
                })
              : null,
        })),
      });
    }
  });

  revalidatePath("/sequences");
  revalidatePath(`/sequences/${parsed.data.sequenceId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setSequenceStatusAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const sequenceId = String(formData.get("sequenceId") || "");
  const status = String(formData.get("status") || "");
  if (!sequenceId || !["active", "paused", "archived"].includes(status)) {
    return { ok: false, error: "Invalid status update." };
  }
  await prisma.sequence.updateMany({
    where: { id: sequenceId, workspaceId: session.workspaceId },
    data: { status: status as "active" | "paused" | "archived" },
  });
  if (status === "paused") {
    await prisma.leadSequenceState.updateMany({
      where: { workspaceId: session.workspaceId, sequenceId, status: "active" },
      data: { status: "paused", pausedAt: new Date() },
    });
  }
  revalidatePath("/sequences");
  revalidatePath(`/sequences/${sequenceId}`);
  return { ok: true };
}

export async function createWorkflowRuleAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const parsed = createWorkflowSchema.safeParse({
    name: formData.get("name"),
    triggerEvent: formData.get("triggerEvent"),
    conditionJson: formData.get("conditionJson") || undefined,
    actionJson: formData.get("actionJson"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid workflow payload." };
  await prisma.workflowRule.create({
    data: {
      workspaceId: session.workspaceId,
      name: parsed.data.name,
      triggerEvent: parsed.data.triggerEvent,
      conditionJson: parsed.data.conditionJson || null,
      actionJson: parsed.data.actionJson,
      status: "active",
    },
  });
  revalidatePath("/");
  return { ok: true };
}

export async function createPlaybookAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin"]);
  const name = String(formData.get("name") || "");
  const category = String(formData.get("category") || "");
  const description = String(formData.get("description") || "");
  if (!name.trim()) return { ok: false, error: "Name is required." };
  const playbook = await createPlaybook({
    workspaceId: session.workspaceId,
    name,
    category: category || undefined,
    description: description || undefined,
  });
  revalidatePath("/");
  return { ok: true, playbookId: playbook.id };
}

export async function applyPlaybookAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const playbookId = String(formData.get("playbookId") || "");
  const leadId = String(formData.get("leadId") || "");
  if (!playbookId || !leadId) return { ok: false, error: "Playbook and lead are required." };
  return applyPlaybookToLead({
    workspaceId: session.workspaceId,
    playbookId,
    leadId,
  });
}

export async function approveOutboundMessageAction(messageId: string) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  await prisma.outboundMessage.updateMany({
    where: { id: messageId, workspaceId: session.workspaceId, status: "pending_approval" },
    data: { status: "approved", nextAttemptAt: new Date() },
  });
  await processOutboundQueue({ limit: 50 });
  revalidatePath("/");
  revalidatePath("/automation/approvals");
  return { ok: true };
}

export async function rejectOutboundMessageAction(messageId: string) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  await prisma.outboundMessage.updateMany({
    where: { id: messageId, workspaceId: session.workspaceId, status: "pending_approval" },
    data: { status: "canceled", lastError: "Rejected by user." },
  });
  revalidatePath("/");
  revalidatePath("/automation/approvals");
  return { ok: true };
}

export async function queueFollowupAutomationAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const leadId = String(formData.get("leadId") || "");
  const mode = (String(formData.get("mode") || "approval_required") as "auto_draft" | "approval_required" | "auto_send");
  if (!leadId) return { ok: false, error: "Lead is required." };
  const result = await runFollowupAutomation({
    workspaceId: session.workspaceId,
    leadId,
    mode,
  });
  if (!result.ok) return result;
  revalidatePath("/");
  return { ok: true, messageId: result.messageId };
}

export async function sendProposalAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const leadId = String(formData.get("leadId") || "");
  const proposalUrl = String(formData.get("proposalUrl") || "");
  const subject = String(formData.get("subject") || "");
  const body = String(formData.get("body") || "");
  if (!leadId || !proposalUrl) return { ok: false, error: "Lead and proposal URL are required." };
  const delivery = await sendProposal({
    workspaceId: session.workspaceId,
    leadId,
    proposalUrl,
    subject: subject || undefined,
    body: body || undefined,
  });
  revalidatePath("/");
  return { ok: true, proposalDeliveryId: delivery.id };
}

export async function enqueueProposalReminderAction(formData: FormData) {
  const session = await requireWorkspaceRole(["owner", "admin", "member"]);
  const leadId = String(formData.get("leadId") || "");
  const proposalDeliveryId = String(formData.get("proposalDeliveryId") || "");
  if (!leadId || !proposalDeliveryId) return { ok: false, error: "Lead and proposal delivery are required." };
  await enqueueProposalReminder({
    workspaceId: session.workspaceId,
    leadId,
    proposalDeliveryId,
  });
  revalidatePath("/");
  return { ok: true };
}
