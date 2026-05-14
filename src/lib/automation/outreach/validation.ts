import { SequenceChannel } from "@prisma/client";
import { validateTemplateVariables } from "@/lib/automation/outreach/template-vars";

export type SequenceStepInput = {
  id?: string;
  name: string;
  channel: SequenceChannel;
  delayMinutes?: number;
  contentTemplate?: string;
  approvalRequired?: boolean;
  subject?: string;
  metadata?: Record<string, unknown>;
};

export function validateSequenceSteps(steps: SequenceStepInput[]) {
  if (!steps.length) {
    return { ok: false as const, error: "At least one step is required." };
  }

  for (const [index, step] of steps.entries()) {
    if (!step.name?.trim()) return { ok: false as const, error: `Step ${index + 1} is missing a name.` };
    if (!["email", "sms", "task", "call"].includes(step.channel)) {
      return { ok: false as const, error: `Step ${index + 1} has unsupported channel.` };
    }
    const delay = Number(step.delayMinutes ?? 0);
    if (!Number.isFinite(delay) || delay < 0 || delay > 60 * 24 * 30) {
      return { ok: false as const, error: `Step ${index + 1} has an invalid delay.` };
    }
    const body = String(step.contentTemplate || "").trim();
    if (!body) return { ok: false as const, error: `Step ${index + 1} is missing a message template.` };
    const bodyVars = validateTemplateVariables(body);
    if (!bodyVars.valid) {
      return { ok: false as const, error: `Step ${index + 1} has invalid variables: ${bodyVars.unknownVariables.join(", ")}` };
    }
    if (step.channel === SequenceChannel.email && step.subject) {
      const subjectVars = validateTemplateVariables(step.subject);
      if (!subjectVars.valid) {
        return {
          ok: false as const,
          error: `Step ${index + 1} subject has invalid variables: ${subjectVars.unknownVariables.join(", ")}`,
        };
      }
    }
    if (step.metadata !== undefined) {
      if (step.metadata === null || Array.isArray(step.metadata) || typeof step.metadata !== "object") {
        return { ok: false as const, error: `Step ${index + 1} has invalid metadata JSON.` };
      }
    }
  }

  return { ok: true as const };
}
