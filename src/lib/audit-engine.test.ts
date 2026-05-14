import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateLeadIntelligence: vi.fn(),
  resolveGenerationContext: vi.fn(),
  ensureWorkspaceOperational: vi.fn(),
  enforceAuditGeneration: vi.fn(),
}));

vi.mock("@/lib/intelligence/engine", () => ({
  generateLeadIntelligence: mocks.generateLeadIntelligence,
}));

vi.mock("@/lib/generation/context", () => ({
  resolveGenerationContext: mocks.resolveGenerationContext,
}));

vi.mock("@/lib/billing/entitlements", () => ({
  ensureWorkspaceOperational: mocks.ensureWorkspaceOperational,
  enforceAuditGeneration: mocks.enforceAuditGeneration,
}));

import { generateAudit } from "./audit-engine";

describe("generateAudit template-driven context", () => {
  it("stores template snapshot and branding context", async () => {
    mocks.resolveGenerationContext.mockResolvedValue({
      workspace: { id: "ws_1", name: "Acme Agency", logoUrl: null, customDomain: null, auditSubdomain: null },
      workspaceSettings: { brandName: "Acme Agency", senderIdentity: "Sam", primaryColor: "#84cc16", accentColor: null, typography: null, footerContent: null, ctaLabelPrimary: null, ctaLabelSecondary: null, auditIntroCopy: null, auditOutroCopy: null },
      auditTemplate: {
        id: "audit_tpl_1",
        name: "General Growth Agency",
        kind: "audit",
        source: "default",
        category: null,
        version: 2,
        config: { tone: "consultative", ctaStyle: "consultative", sectionOrder: ["executiveSummary"], emphasis: [], packageLabels: {}, guaranteeStyle: "results", urgencyStyle: "balanced", outreachStyle: "consultative", proposalStyle: "value" },
      },
      outreachTemplate: {
        id: "out_tpl_1",
        name: "General Outreach",
        kind: "outreach",
        source: "default",
        category: null,
        version: 2,
        config: { tone: "consultative", ctaStyle: "consultative", sectionOrder: ["coldOpen"], emphasis: [], packageLabels: {}, guaranteeStyle: "results", urgencyStyle: "balanced", outreachStyle: "consultative", proposalStyle: "value" },
      },
      offerTemplate: {
        id: "offer_tpl_1",
        name: "General Offer",
        kind: "offer",
        source: "default",
        category: null,
        version: 2,
        config: { tone: "consultative", ctaStyle: "consultative", sectionOrder: ["roi"], emphasis: [], packageLabels: {}, guaranteeStyle: "results", urgencyStyle: "balanced", outreachStyle: "consultative", proposalStyle: "value" },
      },
    });
    mocks.ensureWorkspaceOperational.mockResolvedValue({ ok: true });
    mocks.enforceAuditGeneration.mockResolvedValue({ allowed: true, limit: 120, used: 0, remaining: 120 });
    mocks.generateLeadIntelligence.mockResolvedValue({
      intelligence: {
        scores: { seo: 50, performance: 60, trust: 40, conversion: 45, accessibility: 70, branding: 65 },
        painPoints: ["Missing CTA"],
        strengths: ["Has contact info"],
        urgencyScore: 70,
        momentumScore: 55,
        likelyBudget: "medium",
        recommendedOffer: "Acme Conversion Package",
        outreachAngles: ["Fix conversion flow quickly"],
        objections: ["Need budget sign-off"],
        closeProbability: 64,
        findings: { technical: [], seo: [], conversion: [], trust: [] },
        generatedAt: new Date().toISOString(),
      },
      diagnostics: { source: "local-fallback", fetchWarnings: [], websiteSignals: [] },
      narrative: {
        painPointSummary: "Pain summary",
        likelyMoneyLost: "Likely loss",
        presenceLabsOffer: "Offer summary",
        executiveSummary: "Executive summary",
      },
    });

    const result = await generateAudit({
      businessName: "Test HVAC",
      category: "hvac",
      location: "Austin",
      workspaceId: "ws_1",
    });

    expect(result.generatedContext?.workspaceId).toBe("ws_1");
    expect(result.generatedContext?.templates.audit.id).toBe("audit_tpl_1");
    expect(result.generatedContext?.templates.outreach.id).toBe("out_tpl_1");
    expect(result.generatedContext?.templates.offer.id).toBe("offer_tpl_1");
  });
});
