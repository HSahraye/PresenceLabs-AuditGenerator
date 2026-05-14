import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  proposalFindFirst: vi.fn(),
  enqueueOutboundMessage: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    proposalDelivery: {
      findFirst: mocks.proposalFindFirst,
    },
  },
}));

vi.mock("@/lib/automation/outreach", () => ({
  enqueueOutboundMessage: mocks.enqueueOutboundMessage,
}));

import { enqueueProposalReminder } from "./proposals";

describe("proposal reminders", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("queues reminder for proposal delivery", async () => {
    mocks.proposalFindFirst.mockResolvedValue({
      id: "pd_1",
      proposalUrl: "https://example.com/proposal/1",
    });
    await enqueueProposalReminder({
      workspaceId: "ws_1",
      leadId: "lead_1",
      proposalDeliveryId: "pd_1",
      delayHours: 12,
    });
    expect(mocks.enqueueOutboundMessage).toHaveBeenCalled();
  });
});
