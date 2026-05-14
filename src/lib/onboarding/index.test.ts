import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  count: vi.fn(),
  workspaceUpdate: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingMilestone: {
      upsert: mocks.upsert,
      count: mocks.count,
      findMany: mocks.findMany,
    },
    workspace: {
      update: mocks.workspaceUpdate,
    },
  },
}));

import { getOnboardingProgress, markOnboardingMilestone } from "./index";

describe("onboarding milestones", () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
    mocks.count.mockReset();
    mocks.workspaceUpdate.mockReset();
    mocks.findMany.mockReset();
  });

  it("marks completion and workspace activation", async () => {
    mocks.count.mockResolvedValue(4);
    await markOnboardingMilestone("ws_1", "first_audit_generated");
    expect(mocks.upsert).toHaveBeenCalled();
    expect(mocks.workspaceUpdate).toHaveBeenCalled();
  });

  it("returns ordered progress", async () => {
    mocks.findMany.mockResolvedValue([
      { key: "first_audit_generated", completedAt: new Date() },
      { key: "first_import_completed", completedAt: null },
    ]);
    const progress = await getOnboardingProgress("ws_1");
    expect(progress.total).toBe(4);
    expect(progress.items[0]?.key).toBe("first_audit_generated");
  });
});
