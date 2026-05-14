import type { LeadIntelligence } from "@/lib/intelligence/types";

export function buildOutreachPlan(intelligence: LeadIntelligence) {
  const urgencyTag = intelligence.urgencyScore >= 70 ? "high-urgency" : intelligence.urgencyScore >= 45 ? "medium-urgency" : "low-urgency";
  return {
    urgencyTag,
    primaryAngle: intelligence.outreachAngles[0] || "Highlight conversion opportunities with concrete evidence.",
    backupAngles: intelligence.outreachAngles.slice(1, 4),
    objections: intelligence.objections.slice(0, 4),
  };
}
