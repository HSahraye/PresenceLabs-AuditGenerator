import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  outboundFindMany: vi.fn(),
  outboundUpdate: vi.fn(),
  leadFindUnique: vi.fn(),
  unsubEmailFindUnique: vi.fn(),
  unsubPhoneFindUnique: vi.fn(),
  ensureWorkspaceOperational: vi.fn(),
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
  createTask: vi.fn(),
  createActivity: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outboundMessage: {
      findMany: mocks.outboundFindMany,
      update: mocks.outboundUpdate,
    },
    lead: {
      findUnique: mocks.leadFindUnique,
    },
    unsubscribedContact: {
      findUnique: (...args: unknown[]) => {
        const arg = args[0] as { where: Record<string, unknown> };
        if ("workspaceId_email" in arg.where) return mocks.unsubEmailFindUnique(...args);
        return mocks.unsubPhoneFindUnique(...args);
      },
    },
  },
}));

vi.mock("@/lib/billing/entitlements", () => ({
  ensureWorkspaceOperational: mocks.ensureWorkspaceOperational,
}));

vi.mock("@/lib/communication/email", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/communication/sms", () => ({
  sendSms: mocks.sendSms,
}));

vi.mock("@/lib/automation/tasks", () => ({
  createTask: mocks.createTask,
}));

vi.mock("@/lib/automation/timeline", () => ({
  createActivity: mocks.createActivity,
}));

vi.mock("@/lib/events", () => ({
  trackEvent: mocks.trackEvent,
}));

import { processOutboundQueue } from "./index";

describe("outbound queue processing", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("retries failed provider sends and marks failed after max retries", async () => {
    mocks.outboundFindMany.mockResolvedValue([
      {
        id: "msg_1",
        workspaceId: "ws_1",
        leadId: "lead_1",
        channel: "email",
        subject: "Hello",
        body: "Body",
        retryCount: 4,
      },
    ]);
    mocks.ensureWorkspaceOperational.mockResolvedValue({ ok: true });
    mocks.leadFindUnique.mockResolvedValue({ id: "lead_1", email: "lead@example.com", phone: null });
    mocks.unsubEmailFindUnique.mockResolvedValue(null);
    mocks.sendEmail.mockResolvedValue({ ok: false, provider: "resend", error: "provider down" });

    await processOutboundQueue({ limit: 5 });
    expect(mocks.outboundUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "failed" }),
    }));
  });

  it("blocks send when workspace is suspended", async () => {
    mocks.outboundFindMany.mockResolvedValue([
      {
        id: "msg_2",
        workspaceId: "ws_2",
        leadId: "lead_2",
        channel: "sms",
        subject: null,
        body: "Body",
        retryCount: 0,
      },
    ]);
    mocks.ensureWorkspaceOperational.mockResolvedValue({ ok: false, reason: "Workspace suspended." });
    await processOutboundQueue({ limit: 5 });
    expect(mocks.outboundUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "failed" }),
    }));
  });
});
