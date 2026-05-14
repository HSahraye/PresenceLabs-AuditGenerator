import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    featureFlag: {
      findUnique: mocks.findUnique,
    },
  },
}));

import { isFeatureEnabled } from "./index";

describe("workspace feature flags", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
  });

  it("returns default value when flag is missing", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const enabled = await isFeatureEnabled({ workspaceId: "ws_1", key: "beta_feature", defaultValue: false });
    expect(enabled).toBe(false);
  });

  it("respects enabled flags", async () => {
    mocks.findUnique.mockResolvedValue({ enabled: true, rolloutPct: 100 });
    const enabled = await isFeatureEnabled({ workspaceId: "ws_1", key: "beta_feature" });
    expect(enabled).toBe(true);
  });
});
