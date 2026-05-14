import type { CollectedSignals, Finding, LeadIntelligenceInput } from "@/lib/intelligence/types";

function avg(values: number[]) {
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
}

export function inferLikelyBudget(input: LeadIntelligenceInput, compositeScore: number): "low" | "medium" | "high" {
  const category = (input.category || "").toLowerCase();
  const highIntentCategory = /(law|legal|dent|medical|roof|hvac|plumb|electri|real estate)/.test(category);
  if (highIntentCategory && compositeScore <= 55) return "high";
  if (compositeScore <= 45) return "high";
  if (compositeScore <= 68) return "medium";
  return "low";
}

export function inferUrgencyScore(signals: CollectedSignals, compositeScore: number) {
  let urgency = Math.max(0, 100 - compositeScore);
  if (!signals.hasCta) urgency += 8;
  if (!signals.hasContactInfo) urgency += 10;
  if (!signals.hasHttps) urgency += 8;
  if (signals.fetchWarnings.length) urgency += 6;
  return Math.max(1, Math.min(100, Math.round(urgency)));
}

export function inferMomentumScore(input: LeadIntelligenceInput) {
  const engagement = input.engagementSignals;
  if (!engagement) return undefined;
  let score = 10;
  score += Math.min(40, (engagement.viewCount ?? 0) * 6);
  score += Math.min(30, (engagement.paymentClickCount ?? 0) * 12);
  if (engagement.lastViewedAt) {
    const lastViewedMs = new Date(engagement.lastViewedAt).getTime();
    if (!Number.isNaN(lastViewedMs)) {
      const diffHours = (Date.now() - lastViewedMs) / 3_600_000;
      if (diffHours <= 2) score += 20;
      else if (diffHours <= 24) score += 12;
    }
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function inferRecommendedOffer(
  compositeScore: number,
  likelyBudget: "low" | "medium" | "high",
  signals: CollectedSignals,
) {
  if (!signals.normalizedUrl || compositeScore < 45) return "Presence Labs Launch Package";
  if (likelyBudget === "high" || compositeScore < 65) return "Presence Labs Conversion Upgrade";
  return "Presence Labs Local Trust Tune-Up";
}

export function inferOutreachAngles(
  findings: Finding[],
  signals: CollectedSignals,
  urgencyScore: number,
) {
  const angles: string[] = [];
  if (!signals.hasContactInfo) angles.push("You are likely losing high-intent visitors who cannot quickly contact the business.");
  if (!signals.hasCta) angles.push("A clear call-to-action could convert existing traffic into immediate calls and quote requests.");
  if (!signals.hasReviewSignals) angles.push("Adding review proof can reduce hesitation and improve trust on first visit.");
  if (!signals.hasHttps) angles.push("Security warnings can damage trust before prospects even read your offer.");
  if (urgencyScore >= 70) angles.push("Fixing the top 2 conversion leaks can create immediate revenue lift within weeks.");
  if (!angles.length && findings.length) angles.push(`Addressing ${findings[0]?.title.toLowerCase()} can improve conversion quality.`);
  return angles.slice(0, 5);
}

export function inferObjections(input: LeadIntelligenceInput, likelyBudget: "low" | "medium" | "high") {
  const category = input.category || "local business";
  const defaults = [
    "We already have a website.",
    "This is not in budget right now.",
    "I need to discuss with my partner first.",
  ];
  if (likelyBudget === "low") return [...defaults, "Timing is not right this month."];
  if (likelyBudget === "medium") return [...defaults, `How quickly would this pay off for a ${category} business?`];
  return [...defaults, "Can you prioritize highest-ROI fixes first?"];
}

export function inferCloseProbability({
  categoryScores,
  momentumScore,
  urgencyScore,
}: {
  categoryScores: number[];
  momentumScore?: number;
  urgencyScore: number;
}) {
  const quality = avg(categoryScores);
  const base = Math.max(5, 75 - quality);
  const urgencyBoost = urgencyScore > 70 ? 8 : urgencyScore > 50 ? 4 : 0;
  const momentumBoost = momentumScore ? Math.min(18, Math.round(momentumScore * 0.18)) : 0;
  return Math.max(1, Math.min(95, Math.round(base + urgencyBoost + momentumBoost)));
}
