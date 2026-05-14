import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workflowFindMany: vi.fn(),
  leadUpdateMany: vi.fn(),
  enqueueOutboundMessage: vi.fn(),
  createTask: vi.fn(),
  createActivity: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowRule: {
      findMany: mocks.workflowFindMany,
    },
    lead: {
      updateMany: mocks.leadUpdateMany,
    },
  },
}));

vi.mock("@/lib/automation/outreach", () => ({
  enqueueOutboundMessage: mocks.enqueueOutboundMessage,
}));

vi.mock("@/lib/automation/tasks", () => ({
  createTask: mocks.createTask,
}));

vi.mock("@/lib/automation/timeline", () => ({
  createActivity: mocks.createActivity,
}));

vi.mock("@/lib/automation/notifications", () => ({
  createNotification: mocks.createNotification,
}));

import { triggerWorkflows } from "./index";

describe("workflow automation engine", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("runs actions for matching workflow rule", async () => {
    mocks.workflowFindMany.mockResolvedValue([
      {
        id: "rule_1",
        name: "Payment clicked",
        conditionJson: null,
        actionJson: JSON.stringify({
          actions: [
            { type: "create_task", title: "Call lead now", dueMinutes: 30 },
            { type: "enqueue_email", subject: "Quick follow-up", body: "Let's talk." },
            { type: "notify_owner", title: "High intent lead" },
            { type: "escalate_lead" },
          ],
        }),
      },
    ]);

    await triggerWorkflows({
      workspaceId: "ws_1",
      leadId: "lead_1",
      eventType: "payment_intent_clicked",
      payload: {},
    });

    expect(mocks.createTask).toHaveBeenCalled();
    expect(mocks.enqueueOutboundMessage).toHaveBeenCalled();
    expect(mocks.createNotification).toHaveBeenCalled();
    expect(mocks.leadUpdateMany).toHaveBeenCalled();
    expect(mocks.createActivity).toHaveBeenCalled();
  });

  it("ignores malformed automation rules without throwing", async () => {
    mocks.workflowFindMany.mockResolvedValue([
      {
        id: "rule_2",
        name: "Broken rule",
        conditionJson: "{not-valid-json",
        actionJson: "{also-not-valid",
      },
    ]);
    await expect(
      triggerWorkflows({
        workspaceId: "ws_1",
        leadId: "lead_1",
        eventType: "audit_viewed",
        payload: {},
      }),
    ).resolves.toBeUndefined();
    expect(mocks.createTask).not.toHaveBeenCalled();
  });
});
