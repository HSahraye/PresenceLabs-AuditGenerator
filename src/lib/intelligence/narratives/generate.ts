import { generateNarrative } from "@/lib/ai/provider";
import type { LeadIntelligence, LeadIntelligenceInput } from "@/lib/intelligence/types";

type NarrativeOutput = {
  painPointSummary: string;
  likelyMoneyLost: string;
  presenceLabsOffer: string;
  outreachAngles: string[];
  objections: string[];
  executiveSummary: string;
};

export async function generateIntelligenceNarrative(input: {
  lead: LeadIntelligenceInput;
  intelligence: LeadIntelligence;
}) {
  const ai = await generateNarrative<NarrativeOutput>({
    task: "Explain deterministic intelligence findings for local-business sales outreach.",
    outputContract:
      "{painPointSummary:string,likelyMoneyLost:string,presenceLabsOffer:string,outreachAngles:string[],objections:string[],executiveSummary:string}",
    input: {
      businessName: input.lead.businessName,
      brandName: input.lead.narrativeContext?.brandName ?? "the agency",
      category: input.lead.category,
      location: input.lead.location,
      tone: input.lead.narrativeContext?.tone ?? "consultative",
      outreachStyle: input.lead.narrativeContext?.outreachStyle ?? "consultative",
      proposalStyle: input.lead.narrativeContext?.proposalStyle ?? "value",
      urgencyStyle: input.lead.narrativeContext?.urgencyStyle ?? "balanced",
      ctaStyle: input.lead.narrativeContext?.ctaStyle ?? "consultative",
      emphasis: input.lead.narrativeContext?.emphasis ?? [],
      likelyBudget: input.intelligence.likelyBudget,
      urgencyScore: input.intelligence.urgencyScore,
      closeProbability: input.intelligence.closeProbability,
      scores: input.intelligence.scores,
      strengths: input.intelligence.strengths.slice(0, 4),
      painPoints: input.intelligence.painPoints.slice(0, 6),
      recommendedOffer: input.intelligence.recommendedOffer,
      outreachAngles: input.intelligence.outreachAngles.slice(0, 5),
      objections: input.intelligence.objections.slice(0, 5),
    },
    metadata: {
      workspaceId: input.lead.workspaceId,
      generationType: "intelligence_narrative",
    },
  });

  if (ai) {
    return {
      painPointSummary: ai.painPointSummary,
      likelyMoneyLost: ai.likelyMoneyLost,
      presenceLabsOffer: ai.presenceLabsOffer,
      outreachAngles: Array.isArray(ai.outreachAngles) ? ai.outreachAngles : input.intelligence.outreachAngles,
      objections: Array.isArray(ai.objections) ? ai.objections : input.intelligence.objections,
      executiveSummary: ai.executiveSummary,
      source: "gemini" as const,
    };
  }

  const category = input.lead.category || "local business";
  const location = input.lead.location || "your area";
  const brandName = input.lead.narrativeContext?.brandName || "your agency";
  return {
    painPointSummary: `${input.lead.businessName} shows ${input.intelligence.painPoints.slice(0, 3).join(", ")}. These issues can suppress call and quote conversion for ${category} buyers in ${location}.`,
    likelyMoneyLost: `Based on current conversion and trust gaps, this business is likely leaving meaningful monthly demand unconverted.`,
    presenceLabsOffer: `${input.intelligence.recommendedOffer}: ${brandName} delivers focused conversion, trust, and local SEO upgrades tailored to ${category}.`,
    outreachAngles: input.intelligence.outreachAngles,
    objections: input.intelligence.objections,
    executiveSummary: `Conversion and trust layers are underperforming. Prioritize high-intent visitor flow fixes first.`,
    source: "local-fallback" as const,
  };
}
