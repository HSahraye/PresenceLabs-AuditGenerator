import { LeadSequenceStateStatus, OutboundMessageStatus, SequenceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueOutboundMessage } from "@/lib/automation/outreach";
import { createActivity } from "@/lib/automation/timeline";
import { createTask } from "@/lib/automation/tasks";
import { defaultStepSubject } from "@/lib/automation/outreach/defaults";
import { renderSequenceTemplate } from "@/lib/automation/outreach/template-vars";
import { validateSequenceSteps, type SequenceStepInput } from "@/lib/automation/outreach/validation";

type StepConfig = {
  subject?: string | null;
  metadata?: Record<string, unknown> | null;
};

function parseStepConfig(raw: string | null): StepConfig {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StepConfig;
  } catch {
    return {};
  }
}

export async function createSequence(input: {
  workspaceId: string;
  name: string;
  category?: string;
  steps: SequenceStepInput[];
  autoMode?: string;
}) {
  const validation = validateSequenceSteps(input.steps);
  if (!validation.ok) throw new Error(validation.error);
  return prisma.sequence.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      category: input.category ?? null,
      status: "active",
      autoMode: input.autoMode ?? "approval_required",
      steps: {
        create: input.steps.map((step, index) => ({
          stepOrder: index,
          name: step.name,
          channel: step.channel,
          delayMinutes: step.delayMinutes ?? 0,
          contentTemplate: step.contentTemplate ?? null,
          approvalRequired: step.approvalRequired ?? true,
          conditionJson:
            step.subject || step.metadata
              ? JSON.stringify({
                  subject: step.subject ?? null,
                  metadata: step.metadata ?? null,
                })
              : null,
        })),
      },
    },
    include: { steps: true },
  });
}

export async function startLeadSequence(input: {
  workspaceId: string;
  leadId: string;
  sequenceId: string;
  scheduledStartAt?: Date;
}) {
  const sequence = await prisma.sequence.findFirst({
    where: { id: input.sequenceId, workspaceId: input.workspaceId, status: SequenceStatus.active },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!sequence || sequence.steps.length === 0) {
    return { ok: false as const, error: "Sequence not available." };
  }
  const existing = await prisma.leadSequenceState.findUnique({
    where: { leadId_sequenceId: { leadId: input.leadId, sequenceId: input.sequenceId } },
  });
  if (existing && existing.status === LeadSequenceStateStatus.active) {
    return { ok: false as const, error: "Lead already active in this sequence." };
  }

  const firstStep = sequence.steps[0];
  const baseTime = input.scheduledStartAt ? input.scheduledStartAt.getTime() : Date.now();
  const nextRunAt = new Date(baseTime + firstStep.delayMinutes * 60 * 1000);
  await prisma.leadSequenceState.upsert({
    where: { leadId_sequenceId: { leadId: input.leadId, sequenceId: input.sequenceId } },
    update: {
      status: "active",
      currentStep: 0,
      nextRunAt,
      pausedAt: null,
      exitedAt: null,
      lastError: null,
    },
    create: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      sequenceId: input.sequenceId,
      status: "active",
      currentStep: 0,
      nextRunAt,
    },
  });

  await createActivity({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    type: "sequence.started",
    detail: sequence.name,
    source: "automation",
    metadata: {
      sequenceId: input.sequenceId,
      scheduledStartAt: input.scheduledStartAt?.toISOString() ?? null,
    },
  });
  return { ok: true as const };
}

export async function processLeadSequences(options?: { limit?: number }) {
  const now = new Date();
  const states = await prisma.leadSequenceState.findMany({
    where: {
      status: "active",
      nextRunAt: { lte: now },
      sequence: { status: "active" },
    },
    include: {
      lead: {
        select: {
          id: true,
          businessName: true,
          ownerName: true,
          location: true,
          category: true,
          painSummary: true,
          packageName: true,
        },
      },
      sequence: {
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
        },
      },
    },
    orderBy: { nextRunAt: "asc" },
    take: Math.max(1, Math.min(options?.limit ?? 30, 200)),
  });

  for (const state of states) {
    const step = state.sequence.steps[state.currentStep];
    if (!step) {
      await prisma.leadSequenceState.update({
        where: { id: state.id },
        data: { status: "completed", nextRunAt: null },
      });
      await createActivity({
        workspaceId: state.workspaceId,
        leadId: state.leadId,
        type: "sequence.completed",
        detail: state.sequence.name,
        source: "automation",
      });
      continue;
    }

    const renderContext = {
      businessName: state.lead.businessName,
      ownerName: state.lead.ownerName,
      city: state.lead.location,
      category: state.lead.category,
      painPoint: state.lead.painSummary,
      recommendedOffer: state.lead.packageName,
    };

    if (step.channel === "task" || step.channel === "call") {
      const renderedBody = renderSequenceTemplate(step.contentTemplate, renderContext);
      await createTask({
        workspaceId: state.workspaceId,
        leadId: state.leadId,
        title: step.channel === "call" ? "Call follow-up" : "Manual follow-up task",
        description: renderedBody,
        source: "sequence",
        dueAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await createActivity({
        workspaceId: state.workspaceId,
        leadId: state.leadId,
        type: "sequence.step.executed",
        detail: `${state.sequence.name}: ${step.name}`,
        source: "automation",
        metadata: { sequenceId: state.sequenceId, stepOrder: step.stepOrder, channel: step.channel },
      });
    } else {
      const stepConfig = parseStepConfig(step.conditionJson);
      await enqueueOutboundMessage({
        workspaceId: state.workspaceId,
        leadId: state.leadId,
        sequenceStateId: state.id,
        channel: step.channel,
        subject:
          step.channel === "email"
            ? renderSequenceTemplate(stepConfig.subject || defaultStepSubject("email"), renderContext)
            : undefined,
        body: renderSequenceTemplate(step.contentTemplate, renderContext),
        status: step.approvalRequired ? OutboundMessageStatus.pending_approval : OutboundMessageStatus.queued,
        scheduledAt: new Date(),
        metadata: {
          sequenceId: state.sequenceId,
          stepOrder: step.stepOrder,
          ...(stepConfig.metadata || {}),
        },
      });
      await createActivity({
        workspaceId: state.workspaceId,
        leadId: state.leadId,
        type: step.approvalRequired ? "sequence.approval.requested" : "sequence.step.executed",
        detail: `${state.sequence.name}: ${step.name}`,
        source: "automation",
        metadata: { sequenceId: state.sequenceId, stepOrder: step.stepOrder, channel: step.channel },
      });
    }

    const nextStepIndex = state.currentStep + 1;
    const nextStep = state.sequence.steps[nextStepIndex];
    await prisma.leadSequenceState.update({
      where: { id: state.id },
      data: {
        currentStep: nextStepIndex,
        nextRunAt: nextStep ? new Date(Date.now() + nextStep.delayMinutes * 60 * 1000) : null,
        status: nextStep ? "active" : "completed",
      },
    });
  }
}
