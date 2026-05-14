import { scoreSignals } from "./engine";
import type { CollectedSignals } from "@/lib/intelligence/types";

function mockSignals(overrides: Partial<CollectedSignals> = {}): CollectedSignals {
  return {
    normalizedUrl: "https://example.com",
    html: "<html></html>",
    fetchWarnings: [],
    hasHttps: true,
    hasTitle: true,
    title: "Example Title",
    hasMetaDescription: true,
    metaDescription: "Meta",
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
    bodySize: 10000,
    performanceHint: "good",
    findings: [],
    ...overrides,
  };
}

describe("scoreSignals", () => {
  it("scores strong websites higher", () => {
    const strong = scoreSignals(mockSignals());
    const weak = scoreSignals(
      mockSignals({
        hasCta: false,
        hasContactInfo: false,
        hasMetaDescription: false,
        hasTitle: false,
        hasReviewSignals: false,
        hasTrustBadges: false,
        hasSchemaMarkup: false,
        performanceHint: "poor",
      }),
    );
    expect(strong.composite).toBeGreaterThan(weak.composite);
    expect(strong.scores.conversion).toBeGreaterThan(weak.scores.conversion);
  });
});
