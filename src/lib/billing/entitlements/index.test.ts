import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkspaceUsage: vi.fn(),
  workspaceFindUnique: vi.fn(),
  auditTemplateCount: vi.fn(),
  outreachTemplateCount: vi.fn(),
  offerTemplateCount: vi.fn(),
  membershipCount: vi.fn(),
}));

vi.mock("@/lib/billing/usage", () => ({
  getWorkspaceUsage: mocks.getWorkspaceUsage,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    auditTemplate: { count: mocks.auditTemplateCount },
    outreachTemplate: { count: mocks.outreachTemplateCount },
    offerTemplate: { count: mocks.offerTemplateCount },
    membership: { count: mocks.membershipCount },
  },
}));

import {
  enforceAuditGeneration,
  enforceSeatLimit,
  enforceTemplateLimit,
  ensureWorkspaceOperational,
} from "./index";

describe("billing entitlements", () => {
  beforeEach(() => {
    mocks.getWorkspaceUsage.mockReset();
    mocks.workspaceFindUnique.mockReset();
    mocks.auditTemplateCount.mockReset();
    mocks.outreachTemplateCount.mockReset();
    mocks.offerTemplateCount.mockReset();
    mocks.membershipCount.mockReset();
  });

  it("blocks workspace in delinquent state", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ status: "delinquent", trialEndsAt: null, planTier: "starter" });
    const result = await ensureWorkspaceOperational("ws_1");
    expect(result.ok).toBe(false);
  });

  it("enforces plan limits for audits", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ status: "active", trialEndsAt: null, planTier: "starter" });
    mocks.getWorkspaceUsage.mockResolvedValue({ audits_generated: 120 });
    const result = await enforceAuditGeneration("ws_1");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("enforces template and seat limits", async () => {
    mocks.workspaceFindUnique.mockResolvedValue({ status: "active", trialEndsAt: null, planTier: "starter" });
    mocks.auditTemplateCount.mockResolvedValue(10);
    mocks.outreachTemplateCount.mockResolvedValue(10);
    mocks.offerTemplateCount.mockResolvedValue(6);
    mocks.membershipCount.mockResolvedValue(5);

    const templateResult = await enforceTemplateLimit("ws_1");
    const seatResult = await enforceSeatLimit("ws_1");
    expect(templateResult.allowed).toBe(false);
    expect(seatResult.allowed).toBe(false);
  });
});
