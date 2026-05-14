import { describe, expect, it } from "vitest";
import { generateFollowupRecommendation } from "./brain";
import type { LeadIntelligence } from "@/lib/intelligence/types";

const baseIntelligence: LeadIntelligence = {
  scores: { seo: 55, performance: 62, trust: 45, conversion: 40, accessibility: 70, branding: 58 },
  painPoints: ["Weak CTA placement", "Limited review trust"],
  strengths: ["Mobile friendly"],
  urgencyScore: 72,
  likelyBudget: "medium",
  recommendedOffer: "Presence Labs Conversion Upgrade",
  outreachAngles: ["Viewed pricing but stalled"],
  objections: ["Need to think about budget"],
  closeProbability: 63,
  findings: { technical: [], seo: [], conversion: [], trust: [] },
  generatedAt: new Date().toISOString(),
};

describe("generateFollowupRecommendation", () => {
  it("suggests immediate call for pricing-intent behavior", () => {
    const recommendation = generateFollowupRecommendation({
      intelligence: baseIntelligence,
      engagement: { viewCount: 3, revisitCount: 2, paymentClickCount: 0, outreachRecencyHours: 4 },
    });
    expect(recommendation.recommendedChannel).toBe("call");
    expect(recommendation.urgencyLevel).toBe("high");
  });

  it("suggests re-engagement motion when momentum is cooling", () => {
    const recommendation = generateFollowupRecommendation({
      intelligence: { ...baseIntelligence, urgencyScore: 48 },
      engagement: { viewCount: 5, revisitCount: 1, paymentClickCount: 0, outreachRecencyHours: 150 },
    });
    expect(recommendation.recommendedNextStep.toLowerCase()).toContain("re-engage");
  });
});
