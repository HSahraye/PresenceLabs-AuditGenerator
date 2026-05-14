import { prisma } from "@/lib/prisma";
import { enqueueOutboundMessage } from "@/lib/automation/outreach";
import { createTask } from "@/lib/automation/tasks";
import { createActivity } from "@/lib/automation/timeline";
import { createNotification } from "@/lib/automation/notifications";

type WorkflowTriggerInput = {
  workspaceId: string;
  eventType: string;
  leadId?: string;
  payload?: Record<string, unknown>;
};

function evaluateCondition(conditionJson: string | null, payload: Record<string, unknown>) {
  if (!conditionJson) return true;
  try {
    const parsed = JSON.parse(conditionJson) as {
      field?: string;
      equals?: string | number | boolean;
      gt?: number;
      gte?: number;
      lt?: number;
      lte?: number;
    };
    if (!parsed.field) return true;
    const value = payload[parsed.field];
    if (parsed.equals !== undefined) return value === parsed.equals;
    if (typeof value === "number" && parsed.gt !== undefined) return value > parsed.gt;
    if (typeof value === "number" && parsed.gte !== undefined) return value >= parsed.gte;
    if (typeof value === "number" && parsed.lt !== undefined) return value < parsed.lt;
    if (typeof value === "number" && parsed.lte !== undefined) return value <= parsed.lte;
    return true;
  } catch {
    return true;
  }
}

export async function triggerWorkflows(input: WorkflowTriggerInput) {
  const rules = await prisma.workflowRule.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "active",
      triggerEvent: input.eventType,
    },
  });
  if (!rules.length) return;
  const payload = input.payload || {};

  for (const rule of rules) {
    if (!evaluateCondition(rule.conditionJson, payload)) continue;
    let actions: Array<{ type: string; [key: string]: unknown }> = [];
    try {
      const parsed = JSON.parse(rule.actionJson) as { actions?: Array<{ type: string; [key: string]: unknown }> };
      actions = parsed.actions || [];
    } catch {
      actions = [];
    }
    for (const action of actions) {
      if (action.type === "create_task") {
        await createTask({
          workspaceId: input.workspaceId,
          leadId: input.leadId,
          title: String(action.title || "Workflow task"),
          description: String(action.description || ""),
          source: "workflow",
          dueAt: action.dueMinutes ? new Date(Date.now() + Number(action.dueMinutes) * 60 * 1000) : undefined,
        });
      } else if (action.type === "enqueue_email") {
        await enqueueOutboundMessage({
          workspaceId: input.workspaceId,
          leadId: input.leadId,
          channel: "email",
          subject: String(action.subject || "Quick follow-up"),
          body: String(action.body || "Following up on your audit."),
          status: "pending_approval",
          metadata: { workflowRuleId: rule.id, eventType: input.eventType },
        });
      } else if (action.type === "enqueue_sms") {
        await enqueueOutboundMessage({
          workspaceId: input.workspaceId,
          leadId: input.leadId,
          channel: "sms",
          body: String(action.body || "Quick follow-up from your audit."),
          status: "pending_approval",
          metadata: { workflowRuleId: rule.id, eventType: input.eventType },
        });
      } else if (action.type === "notify_owner") {
        await createNotification({
          workspaceId: input.workspaceId,
          title: String(action.title || "Workflow alert"),
          body: String(action.body || `Workflow rule ${rule.name} triggered.`),
          channel: "in_app",
          metadata: { workflowRuleId: rule.id, eventType: input.eventType },
        });
      } else if (action.type === "escalate_lead" && input.leadId) {
        await prisma.lead.updateMany({
          where: { id: input.leadId, workspaceId: input.workspaceId },
          data: {
            status: "Follow-up",
          },
        });
      }
    }

    await createActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      type: "workflow.triggered",
      detail: `${rule.name} on ${input.eventType}`,
      source: "automation",
      metadata: { workflowRuleId: rule.id },
    });
  }
}
