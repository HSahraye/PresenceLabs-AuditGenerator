import { estimatedDealValue } from "@/lib/money";
import type { LeadIntelligence } from "@/lib/intelligence/types";

type ProposalInput = {
  businessName: string;
  category?: string | null;
  packageName?: string | null;
  customPrice?: number | null;
  intelligence: LeadIntelligence;
  template?: {
    proposalStyle?: string;
    guaranteeStyle?: string;
    urgencyStyle?: string;
    sectionOrder?: string[];
  };
};

export function buildProposalIntelligence(input: ProposalInput) {
  const basePrice = estimatedDealValue(input.packageName || input.intelligence.recommendedOffer, input.customPrice);
  const urgencyMultiplier = input.intelligence.urgencyScore >= 70 ? 1.1 : input.intelligence.urgencyScore >= 45 ? 1 : 0.92;
  const pricingRecommendation = Math.round(basePrice * urgencyMultiplier);
  const category = input.category || "local business";
  const proposalStyle = input.template?.proposalStyle || "value";

  return {
    scopeRecommendations: [
      `Fix top conversion blockers: ${input.intelligence.painPoints.slice(0, 2).join(", ") || "CTA and contact clarity"}.`,
      "Strengthen trust layer with review/social proof placement and credibility sections.",
      "Improve local discoverability with structured SEO and service-page clarity.",
    ],
    pricingRecommendation,
    deliverableSuggestions: [
      "Conversion-focused landing/page structure",
      "Trust + proof section enhancements",
      "Service and CTA hierarchy refinement",
      "Local SEO metadata and schema baseline",
    ],
    roiFraming: `${input.businessName} can likely recover lost demand by addressing high-impact funnel leaks for ${category} buyers (${proposalStyle} positioning).`,
    urgencyFraming: input.intelligence.urgencyScore >= 70
      ? `Act immediately: intent loss risk is high. (${input.template?.urgencyStyle || "balanced"} urgency framing)`
      : "Prioritize this sprint: conversion gains are available now.",
    guaranteeFraming: input.template?.guaranteeStyle || "results-focused guarantee",
    sectionOrder: input.template?.sectionOrder || ["roi", "timeline", "deliverables", "guarantees", "onboarding", "socialProof"],
    timelineSuggestion: pricingRecommendation >= 3000 ? "3-4 weeks implementation window" : "2-3 weeks implementation window",
  };
}
