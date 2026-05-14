import { prisma } from "@/lib/prisma";
import { createSequence, startLeadSequence } from "@/lib/automation/outreach/sequences";

export async function createPlaybook(input: {
  workspaceId: string;
  name: string;
  category?: string;
  description?: string;
  sequenceTemplate?: Array<{
    name: string;
    channel: "email" | "sms" | "task" | "call";
    delayMinutes?: number;
    contentTemplate?: string;
  }>;
}) {
  let sequenceId: string | null = null;
  if (input.sequenceTemplate?.length) {
    const sequence = await createSequence({
      workspaceId: input.workspaceId,
      name: `${input.name} Sequence`,
      category: input.category,
      steps: input.sequenceTemplate,
    });
    sequenceId = sequence.id;
  }

  return prisma.playbook.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      category: input.category ?? null,
      description: input.description ?? null,
      sequenceId,
      workflowIdsJson: JSON.stringify([]),
      templateIdsJson: JSON.stringify([]),
      isActive: true,
    },
  });
}

export async function applyPlaybookToLead(input: {
  workspaceId: string;
  playbookId: string;
  leadId: string;
}) {
  const playbook = await prisma.playbook.findFirst({
    where: { id: input.playbookId, workspaceId: input.workspaceId, isActive: true },
  });
  if (!playbook) return { ok: false as const, error: "Playbook not found." };
  if (playbook.sequenceId) {
    const result = await startLeadSequence({
      workspaceId: input.workspaceId,
      sequenceId: playbook.sequenceId,
      leadId: input.leadId,
    });
    if (!result.ok) return result;
  }
  return { ok: true as const };
}
