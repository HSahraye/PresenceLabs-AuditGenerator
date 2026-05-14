import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWorkspaceRole: vi.fn(),
  outboundUpdateMany: vi.fn(),
  processOutboundQueue: vi.fn(),
  createSequence: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireWorkspaceRole: mocks.requireWorkspaceRole,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outboundMessage: {
      updateMany: mocks.outboundUpdateMany,
    },
    workflowRule: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/automation/outreach", () => ({
  processOutboundQueue: mocks.processOutboundQueue,
}));

vi.mock("@/lib/automation/outreach/sequences", () => ({
  createSequence: mocks.createSequence,
  startLeadSequence: vi.fn(),
}));

vi.mock("@/lib/automation/playbooks", () => ({
  applyPlaybookToLead: vi.fn(),
  createPlaybook: vi.fn(),
}));

vi.mock("@/lib/automation/outreach/followup", () => ({
  runFollowupAutomation: vi.fn(),
}));

vi.mock("@/lib/automation/proposals", () => ({
  sendProposal: vi.fn(),
  enqueueProposalReminder: vi.fn(),
}));

import { approveOutboundMessageAction, createSequenceAction, rejectOutboundMessageAction, saveSequenceBuilderAction } from "./automation";

describe("automation actions", () => {
  it("approves outbound message and triggers processing", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({ workspaceId: "ws_1" });
    const result = await approveOutboundMessageAction("msg_1");
    expect(result.ok).toBe(true);
    expect(mocks.outboundUpdateMany).toHaveBeenCalled();
    expect(mocks.processOutboundQueue).toHaveBeenCalled();
  });

  it("rejects outbound message without triggering processing", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({ workspaceId: "ws_1" });
    const result = await rejectOutboundMessageAction("msg_1");
    expect(result.ok).toBe(true);
    expect(mocks.outboundUpdateMany).toHaveBeenCalled();
  });

  it("creates sequence with valid payload", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({ workspaceId: "ws_1" });
    mocks.createSequence.mockResolvedValue({ id: "seq_1" });
    const formData = new FormData();
    formData.set("name", "Cold Sequence");
    formData.set("category", "cold");
    formData.set("autoMode", "approval_required");
    formData.set(
      "stepsJson",
      JSON.stringify([
        {
          name: "Step 1",
          channel: "email",
          delayMinutes: 0,
          contentTemplate: "Hi {{businessName}}",
          approvalRequired: true,
          subject: "Quick note",
        },
      ]),
    );
    const result = await createSequenceAction(formData);
    expect(result.ok).toBe(true);
    expect(mocks.createSequence).toHaveBeenCalled();
  });

  it("rejects invalid sequence builder config", async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({ workspaceId: "ws_1" });
    const formData = new FormData();
    formData.set("sequenceId", "seq_1");
    formData.set("name", "Broken sequence");
    formData.set("category", "cold");
    formData.set("status", "active");
    formData.set("autoMode", "approval_required");
    formData.set(
      "stepsJson",
      JSON.stringify([
        {
          name: "Step 1",
          channel: "email",
          delayMinutes: 0,
          contentTemplate: "Hi {{badVar}}",
        },
      ]),
    );
    const result = await saveSequenceBuilderAction(formData);
    expect(result.ok).toBe(false);
  });
});
