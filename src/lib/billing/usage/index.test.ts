import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usageRecord: {
      upsert: mocks.upsert,
      findMany: mocks.findMany,
    },
  },
}));

import { getWorkspaceUsage, incrementUsageMetric } from "./index";

describe("usage metering", () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
    mocks.findMany.mockReset();
  });

  it("increments usage atomically with upsert", async () => {
    mocks.upsert.mockResolvedValue({});
    await incrementUsageMetric({ workspaceId: "ws_1", metric: "audits_generated", amount: 2 });
    expect(mocks.upsert).toHaveBeenCalled();
  });

  it("returns usage aggregate map", async () => {
    mocks.findMany.mockResolvedValue([
      { metric: "audits_generated", quantity: 4 },
      { metric: "imported_leads", quantity: 10 },
    ]);
    const usage = await getWorkspaceUsage("ws_1");
    expect(usage.audits_generated).toBe(4);
    expect(usage.imported_leads).toBe(10);
  });
});
