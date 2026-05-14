import {
  inferCloseProbability,
  inferLikelyBudget,
  inferMomentumScore,
  inferUrgencyScore,
} from "./infer";
import type { CollectedSignals } from "@/lib/intelligence/types";

const baseSignals: CollectedSignals = {
  normalizedUrl: "https://example.com",
  html: "<html></html>",
  fetchWarnings: [],
  hasHttps: true,
  hasTitle: true,
  title: "Example",
  hasMetaDescription: true,
  metaDescription: "meta",
  hasViewportMeta: true,
  hasSchemaMarkup: true,
  hasBrokenAnchorTargets: false,
  hasSocialLinks: true,
  hasReviewSignals: true,
  hasTrustBadges: true,
  hasContactInfo: true,
  hasPhonePattern: true,
  hasEmailPattern: true,
  hasCta: true,
  hasBookingLanguage: true,
  hasServiceLanguage: true,
  hasPricingLanguage: true,
  hasFaqLanguage: true,
  hasGalleryLanguage: true,
  hasLocalSeoSignals: true,
  hasAccessibilityLangAttr: true,
  hasImageAltTextHints: true,
  bodySize: 12000,
  performanceHint: "good",
  findings: [],
};

describe("intelligence inference", () => {
  it("raises urgency when conversion basics are missing", () => {
    const urgencyStrong = inferUrgencyScore(baseSignals, 70);
    const urgencyWeak = inferUrgencyScore({ ...baseSignals, hasCta: false, hasContactInfo: false }, 55);
    expect(urgencyWeak).toBeGreaterThan(urgencyStrong);
  });

  it("derives momentum from engagement data", () => {
    const high = inferMomentumScore({ businessName: "A", engagementSignals: { viewCount: 5, paymentClickCount: 1 } });
    const low = inferMomentumScore({ businessName: "A", engagementSignals: { viewCount: 0, paymentClickCount: 0 } });
    expect((high ?? 0)).toBeGreaterThan((low ?? 0));
  });

  it("computes close probability in range", () => {
    const probability = inferCloseProbability({ categoryScores: [60, 70, 55, 50], urgencyScore: 62, momentumScore: 40 });
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThanOrEqual(95);
  });

  it("maps likely budget from score and category", () => {
    const budget = inferLikelyBudget({ businessName: "Law Firm", category: "legal" }, 40);
    expect(["low", "medium", "high"]).toContain(budget);
  });
});
