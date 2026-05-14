import { describe, expect, it } from "vitest";
import {
  getCloseProbability,
  getLeadHealthState,
  getLeadPriorityState,
  getLeadScores,
  getMomentumLevel,
  getPrimaryPainPoints,
  getRecommendedOffer,
  getUrgencyLevel,
} from "./lead";

describe("intelligence selectors", () => {
  const lead = {
    intelligenceJson: JSON.stringify({
      scores: { seo: 70, performance: 65, trust: 62, conversion: 58, accessibility: 72, branding: 66 },
      painPoints: ["Missing social proof", "Weak CTA"],
      strengths: ["Fast page load"],
      urgencyScore: 74,
      likelyBudget: "high",
      recommendedOffer: "Presence Labs Conversion Upgrade",
      outreachAngles: ["High intent from repeat audit views"],
      objections: ["Need stakeholder approval"],
      closeProbability: 71,
      findings: { technical: [], seo: [], conversion: [], trust: [] },
      generatedAt: new Date().toISOString(),
    }),
    viewCount: 3,
    paymentClickCount: 1,
    createdAt: new Date().toISOString(),
  };

  it("prefers intelligence json values", () => {
    expect(getLeadScores(lead).seo).toBe(70);
    expect(getRecommendedOffer(lead)).toContain("Conversion Upgrade");
    expect(getPrimaryPainPoints(lead)[0]).toContain("Missing");
    expect(getCloseProbability(lead)).toBe(71);
    expect(getUrgencyLevel(lead)).toBe("high");
  });

  it("derives priority and health states", () => {
    expect(getLeadPriorityState(lead)).toBe("PAYMENT_READY");
    expect(getLeadHealthState(lead)).toBe("at-risk");
    expect(getMomentumLevel(lead)).toMatch(/rising|stable|cooling/);
  });
});
