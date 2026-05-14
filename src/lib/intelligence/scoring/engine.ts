import type { CollectedSignals, LeadIntelligence } from "@/lib/intelligence/types";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreSignals(
  signals: CollectedSignals,
  weighting?: Partial<Record<keyof LeadIntelligence["scores"], number>>,
) {
  const seo = clamp(
    25 +
      (signals.hasTitle ? 15 : 0) +
      (signals.hasMetaDescription ? 15 : 0) +
      (signals.hasSchemaMarkup ? 10 : 0) +
      (signals.hasLocalSeoSignals ? 15 : 0) +
      (signals.hasServiceLanguage ? 10 : 0) +
      (signals.hasPricingLanguage ? 5 : 0) +
      (signals.hasBrokenAnchorTargets ? -5 : 5),
  );

  const performance = clamp(
    40 +
      (signals.hasViewportMeta ? 15 : -10) +
      (signals.performanceHint === "good" ? 25 : signals.performanceHint === "moderate" ? 10 : -10) +
      (signals.fetchWarnings.length ? -10 : 5),
  );

  const trust = clamp(
    30 +
      (signals.hasHttps ? 15 : -20) +
      (signals.hasTrustBadges ? 20 : 0) +
      (signals.hasReviewSignals ? 20 : 0) +
      (signals.hasSocialLinks ? 10 : 0) +
      (signals.hasContactInfo ? 10 : -10),
  );

  const conversion = clamp(
    30 +
      (signals.hasCta ? 25 : -20) +
      (signals.hasContactInfo ? 20 : -15) +
      (signals.hasBookingLanguage ? 10 : 0) +
      (signals.hasServiceLanguage ? 10 : 0) +
      (signals.hasFaqLanguage ? 5 : 0),
  );

  const accessibility = clamp(
    35 +
      (signals.hasAccessibilityLangAttr ? 25 : 0) +
      (signals.hasImageAltTextHints ? 25 : 0) +
      (signals.hasBrokenAnchorTargets ? -10 : 5),
  );

  const branding = clamp(
    30 +
      (signals.hasGalleryLanguage ? 15 : 0) +
      (signals.hasSocialLinks ? 10 : 0) +
      (signals.hasTrustBadges ? 15 : 0) +
      (signals.hasReviewSignals ? 15 : 0) +
      (signals.hasTitle ? 10 : -10),
  );

  const scores = { seo, performance, trust, conversion, accessibility, branding };
  const defaultWeights = {
    seo: 1,
    performance: 1,
    trust: 1.1,
    conversion: 1.2,
    accessibility: 0.7,
    branding: 0.8,
  };
  const merged = { ...defaultWeights, ...(weighting || {}) };
  const totalWeight = Object.values(merged).reduce((sum, val) => sum + val, 0) || 1;
  const composite = clamp(
    (scores.seo * merged.seo +
      scores.performance * merged.performance +
      scores.trust * merged.trust +
      scores.conversion * merged.conversion +
      scores.accessibility * merged.accessibility +
      scores.branding * merged.branding) /
      totalWeight,
  );
  return { scores, composite };
}
