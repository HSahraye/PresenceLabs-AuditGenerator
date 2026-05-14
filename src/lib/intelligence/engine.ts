import { collectWebsiteSignals } from "@/lib/intelligence/collect/signals";
import { generateIntelligenceNarrative } from "@/lib/intelligence/narratives/generate";
import { derivePainPoints, deriveStrengths, splitFindings } from "@/lib/intelligence/normalization/findings";
import {
  inferCloseProbability,
  inferLikelyBudget,
  inferMomentumScore,
  inferObjections,
  inferOutreachAngles,
  inferRecommendedOffer,
  inferUrgencyScore,
} from "@/lib/intelligence/recommendations/infer";
import { scoreSignals } from "@/lib/intelligence/scoring/engine";
import type { LeadIntelligence, LeadIntelligenceInput } from "@/lib/intelligence/types";

export async function generateLeadIntelligence(input: LeadIntelligenceInput): Promise<{
  intelligence: LeadIntelligence;
  diagnostics: {
    source: "gemini" | "local-fallback";
    fetchWarnings: string[];
    websiteSignals: string[];
  };
  narrative: {
    painPointSummary: string;
    likelyMoneyLost: string;
    presenceLabsOffer: string;
    executiveSummary: string;
  };
}> {
  const collected = await collectWebsiteSignals(input.websiteUrl);
  const { scores } = scoreSignals(collected, input.weighting);
  const findings = splitFindings(collected.findings);
  const painPoints = derivePainPoints(collected.findings);
  const strengths = deriveStrengths(collected);
  const urgencyScore = inferUrgencyScore(collected, Math.round((scores.seo + scores.conversion + scores.trust) / 3));
  const momentumScore = inferMomentumScore(input);
  const likelyBudget = inferLikelyBudget(input, Math.round((scores.seo + scores.performance + scores.conversion + scores.trust) / 4));
  const recommendedOffer = inferRecommendedOffer(
    Math.round((scores.seo + scores.performance + scores.conversion + scores.trust + scores.branding) / 5),
    likelyBudget,
    collected,
  );
  const outreachAngles = inferOutreachAngles(collected.findings, collected, urgencyScore);
  const objections = inferObjections(input, likelyBudget);
  const closeProbability = inferCloseProbability({
    categoryScores: Object.values(scores),
    momentumScore,
    urgencyScore,
  });

  const intelligence: LeadIntelligence = {
    scores,
    painPoints,
    strengths,
    urgencyScore,
    momentumScore,
    likelyBudget,
    recommendedOffer,
    outreachAngles,
    objections,
    closeProbability,
    findings,
    generatedAt: new Date().toISOString(),
  };

  const narrative = await generateIntelligenceNarrative({
    lead: input,
    intelligence,
  });
  return {
    intelligence: {
      ...intelligence,
      outreachAngles: narrative.outreachAngles,
      objections: narrative.objections,
    },
    diagnostics: {
      source: narrative.source,
      fetchWarnings: collected.fetchWarnings,
      websiteSignals: [
        collected.statusCode ? `Website responded with HTTP ${collected.statusCode}.` : "Website response unavailable.",
        ...strengths.map((item) => `Strength: ${item}`),
        ...painPoints.map((item) => `Gap: ${item}`),
      ],
    },
    narrative: {
      painPointSummary: narrative.painPointSummary,
      likelyMoneyLost: narrative.likelyMoneyLost,
      presenceLabsOffer: narrative.presenceLabsOffer,
      executiveSummary: narrative.executiveSummary,
    },
  };
}
