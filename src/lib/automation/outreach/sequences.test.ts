import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sequenceFindFirst: vi.fn(),
  leadSequenceStateFindUnique: vi.fn(),
  leadSequenceStateUpsert: vi.fn(),
  leadSequenceStateFindMany: vi.fn(),
  leadSequenceStateUpdate: vi.fn(),
  enqueueOutboundMessage: vi.fn(),
  createTask: vi.fn(),
  createActivity: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sequence: { findFirst: mocks.sequenceFindFirst },
    leadSequenceState: {
      findUnique: mocks.leadSequenceStateFindUnique,
      upsert: mocks.leadSequenceStateUpsert,
      findMany: mocks.leadSequenceStateFindMany,
      update: mocks.leadSequenceStateUpdate,
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

import { processLeadSequences, startLeadSequence } from "./sequences";

describe("sequence engine", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("starts lead sequence at first step", async () => {
    mocks.sequenceFindFirst.mockResolvedValue({
      id: "seq_1",
      name: "Cold Outreach",
      steps: [{ stepOrder: 0, delayMinutes: 5 }],
    });
    mocks.leadSequenceStateFindUnique.mockResolvedValue(null);
    const result = await startLeadSequence({
      workspaceId: "ws_1",
      leadId: "lead_1",
      sequenceId: "seq_1",
    });
    expect(result.ok).toBe(true);
    expect(mocks.leadSequenceStateUpsert).toHaveBeenCalled();
  });

  it("progresses active sequence and enqueues outbound step", async () => {
    mocks.leadSequenceStateFindMany.mockResolvedValue([
      {
        id: "state_1",
        workspaceId: "ws_1",
        leadId: "lead_1",
        sequenceId: "seq_1",
        currentStep: 0,
        lead: { id: "lead_1", businessName: "Demo Co", ownerName: "Alex" },
        sequence: {
          id: "seq_1",
          name: "Cold Outreach",
          steps: [
            { stepOrder: 0, channel: "email", delayMinutes: 0, contentTemplate: "Hello {{businessName}}", approvalRequired: true },
            { stepOrder: 1, channel: "task", delayMinutes: 60, contentTemplate: "Call {{ownerName}}", approvalRequired: false },
          ],
        },
      },
    ]);
    await processLeadSequences({ limit: 10 });
    expect(mocks.enqueueOutboundMessage).toHaveBeenCalled();
    expect(mocks.leadSequenceStateUpdate).toHaveBeenCalled();
  });

  it("queries only active sequences when processing", async () => {
    mocks.leadSequenceStateFindMany.mockResolvedValue([]);
    await processLeadSequences({ limit: 10 });
    expect(mocks.leadSequenceStateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
          sequence: { status: "active" },
        }),
      }),
    );
  });
});
