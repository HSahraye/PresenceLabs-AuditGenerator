import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  communicationCreate: vi.fn(),
  outboundUpdateMany: vi.fn(),
  unsubUpsertEmail: vi.fn(),
  unsubUpsertPhone: vi.fn(),
  triggerWorkflows: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    communicationEvent: { create: mocks.communicationCreate },
    outboundMessage: { updateMany: mocks.outboundUpdateMany },
    unsubscribedContact: {
      upsert: (...args: unknown[]) => {
        const arg = args[0] as { where: Record<string, unknown> };
        if ("workspaceId_email" in arg.where) return mocks.unsubUpsertEmail(...args);
        return mocks.unsubUpsertPhone(...args);
      },
    },
  },
}));

vi.mock("@/lib/automation/workflows", () => ({
  triggerWorkflows: mocks.triggerWorkflows,
}));

import { POST } from "./route";

describe("communication event tracking", () => {
  it("records unsubscribe and suppresses contact", async () => {
    mocks.communicationCreate.mockResolvedValue({ id: "event_1" });
    const response = await POST(new Request("http://localhost/api/communication/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "ws_1",
        leadId: "lead_1",
        eventType: "unsubscribe",
        metadata: { email: "lead@example.com" },
      }),
    }));
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(mocks.unsubUpsertEmail).toHaveBeenCalled();
    expect(mocks.triggerWorkflows).toHaveBeenCalled();
  });
});
