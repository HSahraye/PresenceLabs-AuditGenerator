import { computeLeadMomentum } from "@/lib/intelligence/momentum/engine";
import type { LeadIntelligence } from "@/lib/intelligence/types";

export type FollowupRecommendation = {
  recommendedNextStep: string;
  recommendedChannel: "call" | "sms" | "email" | "note";
  urgencyLevel: "low" | "medium" | "high";
  suggestedTiming: string;
  outreachFraming: string;
  objectionHandling: string;
};

type FollowupInput = {
  intelligence: LeadIntelligence;
  engagement: {
    viewCount?: number;
    revisitCount?: number;
    paymentClickCount?: number;
    outreachRecencyHours?: number;
    followUpOverdueHours?: number;
    responseCount?: number;
    proposalOpenCount?: number;
    statusAgeDays?: number;
  };
};

export function generateFollowupRecommendation(input: FollowupInput): FollowupRecommendation {
  const momentum = computeLeadMomentum(input.engagement);
  const urgency = Math.max(0, Math.min(100, input.intelligence.urgencyScore + momentum.urgencyDelta));
  const urgencyLevel: FollowupRecommendation["urgencyLevel"] = urgency >= 70 ? "high" : urgency >= 40 ? "medium" : "low";

  const viewedPricingTwice = (input.engagement.revisitCount ?? 0) >= 2 && (input.engagement.paymentClickCount ?? 0) === 0;
  const highEngagementCooling = momentum.engagementTrend === "cooling" && momentum.momentumScore >= 30;
  const reopenedAfterGap = (input.engagement.viewCount ?? 0) >= 3 && (input.engagement.outreachRecencyHours ?? 999) > 96;

  let recommendedChannel: FollowupRecommendation["recommendedChannel"] = "email";
  let recommendedNextStep = "Send concise follow-up with one clear CTA.";
  let suggestedTiming = "within 24 hours";

  if (viewedPricingTwice) {
    recommendedChannel = "call";
    recommendedNextStep = "Clarify pricing confidence and offer a short decision call.";
    suggestedTiming = "today";
  } else if (highEngagementCooling) {
    recommendedChannel = "sms";
    recommendedNextStep = "Re-engage with a short momentum reset message plus quick-win proof.";
    suggestedTiming = "within 12 hours";
  } else if (reopenedAfterGap) {
    recommendedChannel = "call";
    recommendedNextStep = "Treat as reactivation and ask for a 10-minute walkthrough.";
    suggestedTiming = "within 6 hours";
  } else if ((input.engagement.paymentClickCount ?? 0) > 0) {
    recommendedChannel = "call";
    recommendedNextStep = "Close loop on payment intent and remove final objection.";
    suggestedTiming = "immediately";
  }

  return {
    recommendedNextStep,
    recommendedChannel,
    urgencyLevel,
    suggestedTiming,
    outreachFraming: input.intelligence.outreachAngles[0] || "Focus on the highest-impact conversion gap and expected business outcome.",
    objectionHandling: input.intelligence.objections[0] || "Address budget/timing concerns with ROI-focused framing.",
  };
}
